const crypto = require('crypto')
const { validateConfig, splitPattern, createAmqpConnectionAsync } = require('./utils')
const Promise = require('bluebird')

module.exports = async (bishop, options) => {

  const config = validateConfig(options)

  const connection = await createAmqpConnectionAsync(config)
  const followExchange = await connection.exchange(`${config.env}.follow`, config.followExchange)
  const createQueueAsync = (name, options) => {
    return new Promise(resolve => {
      const queue = connection.queue(name, options, () => resolve(queue))
    })
  }

  const publishFollowEventAsync = async (routingKey, message, headers) => {
    const timestamp = Date.now()
    await followExchange.publish(routingKey, new Buffer(JSON.stringify(message || null)), { headers, appId: config.name, timestamp })
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
        const queueId = headers.queue || crypto.createHash('md5').update(routingKey).digest('hex')
        const uniqueQueueName = `follow.${config.client.name}.${queueId}`
        const queue = await createQueueAsync(uniqueQueueName, config.followQueue)
        await queue.bind(followExchange, routingKey)
        queue.subscribe((message, headers) => {
          listener(JSON.parse(message.data), headers)
        })
      }
  }

  bishop.register('transport', config.name, methods)
}
