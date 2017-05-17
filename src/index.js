const { createAmqpChannel, defaultErrorHandler } = require('./transport')
const { defaultConfig, patternPieces } = require('./utils')

/**
 * Emit message into amqp queue as event
 * routingKey, message, headers
 */
function createEventEmitter(config, channel, exchange) {
  const { appId } = config
  return async (routingKey, message, headers) => {
    const timestamp = Date.now()
    // console.log('[event emitted]', routingKey)
    await channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message || null)), { headers, appId, timestamp })
  }
}

/**
 * 1) create anonymous queue
 * 2) bind to specified routing key
 * 3) fire handler on every message in queue
 */
async function createEventListenerAsync(config, channel, exchange, routingKey, handler) {
    const { queue } = await channel.assertQueue(null, exchange, config.defQueueOpts)
    await channel.bindQueue(queue, exchange, routingKey)
    await channel.consume(queue, message => handler(message, channel), config.defConsumerOpts)
}


module.exports = async (bishop, options) => {

  const config = defaultConfig(options)

  const channel = await createAmqpChannel(config, defaultErrorHandler)
  const { exchange } = await channel.assertExchange(config.eventsQueueName, 'topic', config.defExchangeOpts)

  const eventEmitterAsync = await createEventEmitter(config, channel, exchange)

  const methods = {

    /**
     * Emit notification message into AMQP queue
     */
      notify(message, headers) {
        const routingKey = patternPieces(headers.pattern).join('.')
        return eventEmitterAsync(routingKey, message, headers)
      },

    /**
     * Listen incoming patterns and match them against bishop
     */
      async follow(message, listener) {
        const routingKey = `#.${patternPieces(message).join('.#.')}.#`
        return createEventListenerAsync(config, channel, exchange, routingKey, (data) => {
          listener(JSON.parse(data.content), data.properties.headers)
        })
      }
  }

  bishop.register('transport', config.name, methods)
}
