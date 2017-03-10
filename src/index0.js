// http://www.squaremobius.net/amqp.node/channel_api.html
const ld = require('lodash')
const amqplib = require('amqplib')
const os = require('os')
const shortid = require('shortid')

const defaultOptions = {
  name: 'amqp',
  appId: null,
  role: null,                           // specify one role: client, server (default: both)
  pattern: null,                        // [client]: automaticly bind specified pattern to transport if set
  queueName: null,                      // [server] common services queue to listen incoming messages (will generate own if not set)
  routingKey: null,                     // [client/server]: routing key for incoming public messages
  connection: 'amqp://localhost',       // connection url
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
  exchangeName: 'node-d',
  defExchangeOpts: {
    durable: true,      // will survive after server restart
    autoDelete: false   // do not delete if consumers are gone
    // alternateExchange: '' // send to this exchange if this one cant route
  },
  defPublishOpts: {
    // cc: [...], // send message copy to...
    persistent: true,
    mandatory: true // rabbitmq only, will send back if no binding found
  }
}
module.exports = async (bishop, options = {}) => {
  const config = ld.defaultsDeep({}, options, defaultOptions)
  const defaultTimeout = config.timeout || bishop.config.timeout
  if (!defaultTimeout) {
    bishop.log.warn('default timeout is not set - application may hang on logic bugs')
  }

  const isServer = !config.role || config.role === 'server'
  const isClient = !config.role || config.role === 'client'

  if (!config.routingKey) {
    throw new Error('please specify .routingKey')
  }
  if (!isServer && !isClient) {
    throw new Error('should specify server or client in .role (or leave empty)')
  }
  const appId = config.appId || `${config.name}#default`


  // 2do: respect $timeout, $nowait

  // connect to AMQP instance
  const connection = await amqplib.connect(config.connection)
  const channel = await connection.createChannel()

  channel.on('error', bishop.onError) // handle error by bishop function
  channel.on('return', message => {
    // 2do: amqp pattern not found, inform about it in response
    bishop.log.warn('message returned', message)
  })
  channel.on('drain', () => bishop.log.info(`[${config.name}] is ready after draining`))
  const { exchange } = await channel.assertExchange(config.exchangeName, 'topic', config.defExchangeOpts)

  if (isServer) { // listen and response to incoming requets
    const serverQueueName = config.queueName || `${config.name}.bishop`
    const { queue } = await channel.assertQueue(serverQueueName, exchange, config.defQueueOpts)
    await channel.bindQueue(queue, exchange, config.routingKey)
    const { consumerTag } = await channel.consume(queue, ({ content, fields, properties }) => {
      if (consumerTag !== fields.consumerTag) {
        throw new Error('message delivered not for me')
      }
      // 2do: magic
    }, config.defConsumerOpts)
    console.log(`bound to server as ${consumerTag}`)
  }

  if (isClient) { // setup handler for client requests
    const clientQueueName = `${config.name}.${os.hostname()}.${process.pid}`
    const { queue } = await channel.assertQueue(clientQueueName, exchange, config.defQueueOpts)
    await channel.bindQueue(queue, exchange, config.routingKey)
    const { consumerTag } = await channel.consume(queue, ({ content, fields, properties }) => {
      if (consumerTag !== fields.consumerTag) {
        throw new Error('message delivered not for me')
      }
      // 2do: magic
    }, config.defConsumerOpts)

    // register transport so local client can send request to remote system
    bishop.addTransport(config.name, message => {
      const { $timeout, $id } = message
      const timeout = ($timeout || defaultTimeout) + 10
      const replyTo = queue // send response back to queue
      const correlationId = shortid.generate()
      // 2do: wait for response

      const options = Object.assign({}, config.defPublishOpts, { appId, replyTo, correlationId })
      if (timeout) {
        options.expiration = timeout
      }
      if ($id) {
        options.messageId = $id
      }
      console.log('1', exchange, typeof exchange)
      console.log('2', config.routingKey, typeof config.routingKey)
      const res = channel.publish(exchange, config.routingKey, new Buffer(JSON.stringify(message)), options)
      console.log(res)
        // .then(isQueryFull => {
        //   console.log('>>>', isQueryFull)
        // })
        // .catch(err => {
        //   console.log('2222')
        //   console.log(err)
        //   process.exit()
        // })

    }, config)

    // add pattern for routes into remote system (can be omitted)
    if (config.pattern) {
      bishop.add(config.pattern, config.name)
    }

    console.log(`bound to client as ${consumerTag}`)
  }

}
