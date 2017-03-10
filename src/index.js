// http://www.squaremobius.net/amqp.node/channel_api.html
const ld = require('lodash')
const amqplib = require('amqplib')
const os = require('os')
const shortid = require('shortid')

const defaultOptions = {
  name: 'amqp',
  exchange: 'bishop',
  roles: ['client', 'server', 'emitter'],
  topicPrefix: 'bishop',
  defExchangeOpts: {
    durable: true,      // will survive after server restart
    autoDelete: false   // do not delete if consumers are gone
  }
}

module.exports = async (bishop, options = {}) => {
  const config = ld.defaultsDeep({}, options, defaultOptions)
  // const defaultTimeout = config.timeout || bishop.config.timeout

  // connect to AMQP instance
  const connection = await amqplib.connect(config.connection)
  const channel = await connection.createChannel()

  channel.on('error', bishop.onError) // handle error by bishop function
  channel.on('return', message => {
    // 2do: amqp pattern not found, inform about it in response
    bishop.log.warn('message returned', message)
  })
  channel.on('drain', () => bishop.log.info(`[${config.name}] is ready after draining`))

  if (config.roles.includes('emitter')) {
    const { exchange } = await channel.assertExchange(`${config.exchange}.events`, 'topic', config.defExchangeOpts)
    // 2do: add bishop handler with unique name to all messages in the end
    bishop.register('after', message => {
      console.log('got message:')
      console.log(message)
      return message
    })
  }

}
