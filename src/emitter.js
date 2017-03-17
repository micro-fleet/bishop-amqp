const ld = require('lodash')
const { createAmqpChannel } = require('./transport')
const { routingKeyFromPattern } = require('./utils')

const defaultConfig = userConfig => {
  return ld.defaultsDeep({},
    ld.pick(require('./defaults'), ['connection', 'appId', 'name', 'defExchangeOpts', 'defConsumerOpts']),
    userConfig || {}
  )
}

// create emitter, which will send incoming message into amqp instance
const createEventEmitter = async (userOptions, errorHandler) => {
  const config = defaultConfig(userOptions)
  const channel = await createAmqpChannel(config, errorHandler)
  const { exchange } = await channel.assertExchange(`${config.name}.events`, 'topic', config.defExchangeOpts)

  const { appId } = config
  return async (message, headers) => {
    const { routingKey } = headers
    if (routingKey) {
      const timestamp = Date.now()
      await channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message)), { headers, appId, timestamp })
    }
    return message
  }
}

const createEventListener = async (userOptions, errorHandler) => {
  const config = defaultConfig(userOptions)
  const channel = await createAmqpChannel(config, errorHandler)
  const { exchange } = await channel.assertExchange(`${config.name}.events`, 'topic', config.defExchangeOpts)
  const { queue } = await channel.assertQueue('', exchange, config.defQueueOpts)

  return {
    // bind queue using specific pattern mask
    async on(pattern, handler) {
      const routingKey = `#.${routingKeyFromPattern(pattern).split('.').join('.#.')}.#`
      // console.log('[bind]', queue, exchange, routingKey)
      await channel.bindQueue(queue, exchange, routingKey)
      await channel.consume(queue, ({ content, properties }) => {
        handler(JSON.parse(content), properties.headers)
      }, config.defConsumerOpts)
    }
  }
}

// set message header so it will be emitted into queue in the end of processing
const setMessageAsEmittable = (message, headers) => {
  headers.routingKey = routingKeyFromPattern(headers.pattern)
  return message
}

module.exports = { createEventEmitter, setMessageAsEmittable, createEventListener }
