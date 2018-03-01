const { createTraceSpan, finishSpan } = require('@fulldive/common/src/tracer')
const { validateOrThrow } = require('@fulldive/common/src/joi')
const AMQPTransport = require('@microfleet/transport-amqp')

const { splitPattern, uniqueFollowQueueName } = require('./utils')

const schemas = require('./options')

module.exports = async (bishop, _options) => {
  const options = validateOrThrow(_options, schemas.init)
  const { tracer, log = console } = bishop
  const { name, version, timeout } = options

  const AMQPOptions = {
    ...options.amqp,
    name,
    version,
    timeout,
    tracer
  }

  const amqp = await AMQPTransport.connect(AMQPOptions)

  const methods = {
    /**
     * Emit notification message into AMQP queue
     */
    notify(message, bishopHeaders) {
      const routingKey = splitPattern(bishopHeaders.pattern).join('.')
      const options = {
        headers: {
          bishopHeaders: JSON.stringify(bishopHeaders)
        }
      }
      return amqp.publish(routingKey, message, options)
    },

    /**
     * Listen incoming patterns and match them against bishop.
     * Every message should be delivered to one app instance only by default
     */
    async follow(message, listener, _config) {
      const config = validateOrThrow(_config, schemas.follow)

      const routingKey = `#.${splitPattern(message).join('.#.')}.#`
      const queueName =
        config.queue || uniqueFollowQueueName(routingKey, 'follow', options.name, options.env)

      // https://github.com/microfleet/transport-amqp/blob/69db5cef19d9e09f15a40b7dbc7891b5d9dbcb73/src/amqp.js#L101
      function router(message, properties /*, raw*/) {
        const { headers } = properties
        const { bishopHeaders: bishopHeadersString } = headers

        const bishopHeaders = JSON.parse(bishopHeadersString)

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
      await amqp.bindRoute(options.amqp.exchange, queue, routingKey)
      log.info(`listen queue="${queueName}", route="${routingKey}"`)
    }
  }

  bishop.register('transport', options.name, methods)
}
