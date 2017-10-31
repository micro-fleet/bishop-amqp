const crypto = require('crypto')
const { validateConfig, splitPattern, createAmqpConnectionAsync } = require('./utils')
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
    const payload = [message || null, headers]
    await followExchange.publish(routingKey, new Buffer(JSON.stringify(payload)), {
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
      queue.subscribe((data /*, headers*/) => {
        let bishopMessage, bishopHeaders
        try {
          const arr = JSON.parse(data.data)
          if (!Array.isArray(arr) || arr.length !== 2) {
            throw new Error('wrong format')
          }
          bishopMessage = arr[0]
          bishopHeaders = arr[1]
        } catch (err) {
          return console.error('invalid incoming AMQP message, [message, headers] expected')
        }
        listener(bishopMessage, bishopHeaders)
      })
    }
  }

  bishop.register('transport', config.name, methods)
}
