const { validateOrThrow } = require('@fulldive/common/src/joi')
const AMQPTransport = require('@microfleet/transport-amqp')

const {
  splitPattern,
  uniqueQueueName,
  objectifyConnectionUrl,
  creteFollowRouter
} = require('./utils')

const optionsSchema = require('./options')

const RPC_QUEUE_PREFIX = 'rpc'
const DEFAULT_TIMEOUT = 5000
const TIMEOUT_OFFSET = 100

module.exports = async (bishop, _options = {}) => {
  const options = validateOrThrow(_options, optionsSchema)
  options.amqp.connection = objectifyConnectionUrl(options.amqp.connection)
  const { tracer, log = console } = bishop
  const { name, version, timeout } = options

  // took bishop default timeout if transport's one is not set
  const defaultTimeout = timeout || bishop.config.timeout || DEFAULT_TIMEOUT

  const AMQPOptions = {
    ...options.amqp,
    // "rpc.{servicename}.default"
    queue: uniqueQueueName(null, RPC_QUEUE_PREFIX, name, options.env),
    tracer,
    name,
    version,
    timeout: defaultTimeout,
    private: true,
    defaultQueueOpts: {
      autoDelete: true
    },
    privateQueueOpts: {
      autoDelete: true
    }
  }

  /**
   * Listen incoming messages, search result in local bishop instance and return response
   */
  const rpcListener = (message, properties, actions, callback) => {
    const $timeout =
      (properties.headers.timeout && properties.headers.timeout - TIMEOUT_OFFSET) || defaultTimeout
    ;(async () => {
      try {
        const result = await bishop.act({
          ...message,
          $local: true,
          $timeout
        })
        callback(null, result)
      } catch (err) {
        callback(err)
      } finally {
        // mark message as handled in any case
        // on error - response will be sent to consumer so no need to requeue this message
        actions.ack && actions.ack()
      }
    })()
  }

  const amqp = await AMQPTransport.connect(
    AMQPOptions,
    rpcListener
  ).timeout(
    options.amqp.connectTimeout,
    `AMQP service is still not available after ${options.amqp.connectTimeout}ms`
  )

  // declare exchange for bishop.follow
  const followExchange = await amqp._amqp.exchangeAsync({
    autoDelete: false, // will stay if none consumers are connected
    durable: true, // will survive brocker restart
    type: 'topic',
    exchange: options.followExchange // default exchange name is "bishop.follow"
  })
  await followExchange.declareAsync()

  const methods = {
    amqp,
    /**
     * Emit notification message into AMQP follow queue
     */
    notify(message, bishopHeaders) {
      // notify full source pattern of the message so consumers could subsribe on part of it
      const routingKey = splitPattern(bishopHeaders.source).join('.')
      // const routingKey = splitPattern(bishopHeaders.pattern).join('.')
      // we do not use timeout in notification messages - they should exists untoll "follow"-specific queues will be destroyed after ttl
      const config = {
        exchange: options.followExchange,
        headers: {
          bishopHeaders: JSON.stringify(bishopHeaders)
        }
      }
      const result = typeof message === 'undefined' ? null : message // unable to publish undefined using current transport library
      // log.debug(`send follow event route="${routingKey}", exchange="${options.followExchange}"`)

      return amqp.publish(routingKey, result, config)
    },

    /**
     * Listen incoming patterns and match them against bishop.
     * Every message should be delivered to one app instance only by default
     */
    async follow(message, listener, config) {
      const routingKey = `#.${splitPattern(message).join('.#.')}.#`
      const queueOptions = { ...options.followQueueOpts, ...config }
      // WARN: queue name should be the same between instances to avoid messaging duplication
      queueOptions.queue =
        queueOptions.queue || uniqueQueueName(routingKey, 'follow', options.name, options.env) // "follow.{servicename}.default.{routingKeyHash}"
      queueOptions.router = creteFollowRouter({ listener, tracer, options })
      const { queue } = await amqp.createQueue(queueOptions)
      await amqp.bindRoute(options.followExchange, queue, routingKey)
      log.debug(
        `listen queue="${queueOptions.queue}", route="${routingKey}", exchange="${
          options.followExchange
        }"`
      )
    },

    /**
     * Send request to specefied queue/receiver and wait for the answer
     */
    async request(message, headers) {
      const { receiver, timeout } = headers
      if (!receiver) {
        throw new Error('Unable to send pattern - $receiver is not set')
      }
      const queueName = uniqueQueueName(null, RPC_QUEUE_PREFIX, receiver, options.env)
      const config = {
        confirm: true, // wait for commit confirmation
        mandatory: true, // exception if message cant be routed to queue
        headers: {
          bishopHeaders: JSON.stringify(headers)
        }
      }
      // proxy timeout if set in request
      config.headers.timeout = (timeout || defaultTimeout) + TIMEOUT_OFFSET

      const result = typeof message === 'undefined' ? null : message
      return amqp.sendAndWait(queueName, result, config).catch(err => {
        // handle "no amqp route" error and convert it into bishop error
        if (err.replyText === 'NO_ROUTE') {
          err.message = `remote service does not exist on route ${err.routingKey}`
        }
        throw err
      })
    }
  }

  bishop.register('transport', options.name, methods)
}
