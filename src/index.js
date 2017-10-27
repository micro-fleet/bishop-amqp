const crypto = require('crypto')
const {
  validateConfig,
  splitPattern,
  createAmqpConnectionAsync,
  amqpCompatibleValue
} = require('./utils')
const Promise = require('bluebird')

module.exports = async (bishop, options) => {
  const config = validateConfig(options)

  const { name: clientName, version: clientVersion } = config.client
  const connection = await createAmqpConnectionAsync(config)
  const followExchangeName = `${config.env}.follow`
  const followExchange = await connection.exchange(followExchangeName, config.followExchange)
  const createQueueAsync = (name, options) => {
    return new Promise(resolve => {
      const queue = connection.queue(name, options, () => {
        return resolve(queue)
      })
    })
  }

  const publishFollowEventAsync = async (routingKey, message, headers) => {
    const timestamp = Date.now()
    await followExchange.publish(routingKey, new Buffer(JSON.stringify(message || null)), {
      headers,
      appId: `${clientName}@${clientVersion}`,
      timestamp
    })
  }

  const methods = {
    /**
     * Emit notification message into AMQP queue
     */
    notify(message, headers) {
      const routingKey = splitPattern(headers.pattern).join('.')
      // remove 'undefined' from headers to avoid `unsupported type in amqp table: undefined` error due to serialization problem
      headers.pattern = amqpCompatibleValue(headers.pattern, '')
      headers.source = amqpCompatibleValue(headers.source, '')
      return publishFollowEventAsync(routingKey, message, headers)
    },

    /**
     * Listen incoming patterns and match them against bishop
     */
    async follow(message, listener, headers) {
      const routingKey = `#.${splitPattern(message).join('.#.')}.#`
      // create unique queue name for this follow event (message will be delivered to one instance of an app only)
      const queueId =
        headers.queue ||
        crypto
          .createHash('md5')
          .update(routingKey)
          .digest('hex')
      const uniqueQueueName = `follow.${config.env}.${clientName}.${queueId}`
      const queue = await createQueueAsync(uniqueQueueName, config.followQueue)
      await queue.bind(followExchange, routingKey)
      console.log(`Listen: queue="${uniqueQueueName}", route="${routingKey}"`)
      queue.subscribe((message, headers) => {
        listener(JSON.parse(message.data), headers)
      })
    }
  }

  bishop.register('transport', config.name, methods)
}
