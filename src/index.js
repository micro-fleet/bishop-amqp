const { createTraceSpan, finishSpan } = require('@fulldive/common/src/tracer')
const { validateOrThrow } = require('@fulldive/common/src/joi')
const AMQPTransport = require('@microfleet/transport-amqp')

const { splitPattern, uniqueFollowQueueName, objectifyConnectionUrl } = require('./utils')

const schemas = require('./options')

module.exports = async (bishop, _options = {}) => {
  const options = validateOrThrow(_options, schemas.init)
  options.amqp.connection = objectifyConnectionUrl(options.amqp.connection)
  const { tracer, log = console } = bishop
  const { name, version, timeout } = options

  const AMQPOptions = {
    ...options.amqp,
    name,
    version,
    timeout
  }
  const amqp = await AMQPTransport.connect(AMQPOptions)

  // declare exchange for .follow
  // durable=false, autoDelete=true for backward compatibility purposes
  const followExchange = await amqp._amqp.exchangeAsync({
    autoDelete: true,
    durable: false,
    type: 'topic',
    exchange: options.followExchange
  })
  await followExchange.declareAsync()

  const methods = {
    /**
     * Emit notification message into AMQP follow queue
     */
    notify(message, bishopHeaders) {
      const routingKey = splitPattern(bishopHeaders.pattern).join('.')
      const config = {
        exchange: options.followExchange,
        headers: {
          bishopHeaders: JSON.stringify(bishopHeaders)
        }
      }
      return amqp.publish(routingKey, message, config)
    },

    /**
     * Listen incoming patterns and match them against bishop.
     * Every message should be delivered to one app instance only by default
     */
    async follow(message, listener, _config) {
      const config = validateOrThrow(_config, schemas.follow)

      const routingKey = `#.${splitPattern(message).join('.#.')}.#`
      // WARN: queue name should be the same between instances to avoid messagind dublication
      const queueName =
        config.queue || uniqueFollowQueueName(routingKey, 'follow', options.name, options.env)

      // https://github.com/microfleet/transport-amqp/blob/69db5cef19d9e09f15a40b7dbc7891b5d9dbcb73/src/amqp.js#L101
      function router(_message, properties /*, raw*/) {
        const bishopHeadersString = properties.headers && properties.headers.bishopHeaders
        let bishopHeaders, message
        // backward compatibility with previous bishop version
        if (!bishopHeadersString) {
          const [realMessage, _bishopHeaders] = _message
          message = realMessage
          bishopHeaders = _bishopHeaders
        } else {
          bishopHeaders = JSON.parse(bishopHeadersString)
          message = _message
        }

        const span = createTraceSpan(tracer, 'follow:handler', bishopHeaders.trace)
        span.setTag('bishop.follow.pattern', bishopHeaders.pattern)
        span.setTag('bishop.follow.source', bishopHeaders.source)
        listener(message, bishopHeaders)
          .catch(err => {
            finishSpan(span, err)
            throw err
          })
          .then(result => {
            finishSpan(span)
            return result
          })
      }

      const { queue } = await amqp.createQueue({ queue: queueName, router })
      await amqp.bindRoute(options.followExchange, queue, routingKey)
      log.info(
        `listen queue="${queueName}", route="${routingKey}", exchange="${options.followExchange}"`
      )
    }
  }

  bishop.register('transport', options.name, methods)
}
