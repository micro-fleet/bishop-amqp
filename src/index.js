// http://www.squaremobius.net/amqp.node/channel_api.html
const ld = require('lodash')
const Promise = require('bluebird')
const amqplib = require('amqplib')
const os = require('os')

const defaultOptions = {
  name: 'amqp',                         // client/server: transport name/alias
  pattern: null,                        // [client]: automaticly bind specified pattern to transport
  routingKey: null,                     // server: routing key for incoming messages
  queueName: null,                      // [server]: queue to bind (default: create anonymous queue)
  exchange: 'bishop',                   // [client/server]: exchange name
  connection: 'amqp://localhost',        // [client/server]: connection url
  defConsumerOpts: {
    noAck: false,
    priority: 10
  },
  defQueueOpts: {
    exclusive: false,
    durable: true,
    autoDelete: false,
    arguments: {
      maxPriority: 100,
      // maxLength: 100000 // old messages will be discarded
      // messageTtl: 100000 // message will be discarded after ms
      // deadLetterExchange: 'string' // then messages expired, rejected or nacked
    }
  },
  defExchangeOpts: {
    durable: true,      // will survive after server restart
    internal: true,     // dont push directly (messages should came over pattern)
    autoDelete: false   // do not delete if consumers are gone
    // alternateExchange: '' // send to this exchange if this one cant route
  },
  defPublishOpts: {
    // expiration: 10000, // remove after ms
    // userId: '...' // use same
    // cc: [...], // send message copy to...
    // persistent: true,
    // mandatory: true // rabbitmq only, will send back if no binding found
    // appId: 'mesage-id',
    // correlationId,
    // replyTo: '123',
    // messageId,
  }
}
module.exports = async (bishop, options = {}) => {
  const config = ld.defaultsDeep({}, options, defaultOptions)
  const defaultTimeout = config.timeout || bishop.config.timeout
  if (!defaultTimeout) {
    bishop.log.warn('default timeout is not set - application may hang on logic bugs')
  }
  const processId = `${config.name}.${os.hostname()}.${process.pid}`
  // $timeout, $nowait

  // connect to AMQP instance
  const connection = await amqplib.connect(config.connection)
  const channel = await connection.createChannel()

  channel.on('error', bishop.onError) // handle error by bishop function
  channel.on('return', message => {
    // 2do: amqp pattern not found, inform about it in response
    bishop.log.warn('message returned', message)
  })
  channel.on('drain', () => bishop.log.info(`[${config.name}] is ready after draining`))
  const { exchange } = await channel.assertExchange(config.exchange, 'topic', config.defExchangeOpts)
  const { queue } = await channel.assertQueue(processId, exchange, config.defQueueOpts)
  await channel.bindQueue(queue, exchange, 'some.pattern')

  const { consumerTag } = await channel.consume(queue, ({ content, fields, properties }) => {
    if (consumerTag !== fields.consumerTag) {
      throw new Error('message delivered not for me')
    }
    //
  }, config.defConsumerOpts)

  console.log(`bound to server as ${consumerTag}`)
  // const sentImmediately = await channel.publish(exchange, 'some.pattern', new Buffer('hello'), config.defPublishOpts)

  const isServer = !!config.routingKey


}
