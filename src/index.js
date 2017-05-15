const { createAmqpChannel, defaultErrorHandler } = require('./transport')
const { routingKeyFromPattern, defaultConfig } = require('./utils')

/**
 * Emit message into amqp queue as event
 * routingKey, message, headers
 */
function createEventEmitter(config, channel, exchange) {
  const { appId } = config
  return async (routingKey, message, headers) => {
    const timestamp = Date.now()
    await channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message || null)), { headers, appId, timestamp })
  }
}

async function createEventListenerAsync(config, channel, exchange, queue, routingKey, handler) {
    await channel.bindQueue(queue, exchange, routingKey)
    await channel.consume(queue, message => handler(message, channel), config.defConsumerOpts)
}


module.exports = async (bishop, options) => {

  const config = defaultConfig(options)

  const channel = await createAmqpChannel(config, defaultErrorHandler)
  const { exchange } = await channel.assertExchange(`${config.name}.events`, 'topic', config.defExchangeOpts)
  const { queue } = await channel.assertQueue(config.queueName, exchange, config.defQueueOpts)

  const eventEmitterAsync = await createEventEmitter(config, channel, exchange)

  const methods = {

    /**
     * Emit notification message into AMQP queue
     */
      notify(message, headers) {
        const routingKey = routingKeyFromPattern(headers.pattern)
        return eventEmitterAsync(routingKey, message, headers)
      },

    /**
     * Listen incoming patterns and match them against bishop
     */
      follow(message, listener) {
        const routingKey = `#.${routingKeyFromPattern(message).split('.').join('.#.')}.#`
        return createEventListenerAsync(config, channel, exchange, queue, routingKey, (data) => {
          // console.log(data)
          listener(JSON.parse(data.content), data.properties.headers)
        })
      }
  }

  bishop.register('transport', config.name, methods)
}
