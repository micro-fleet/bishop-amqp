// http://www.squaremobius.net/amqp.node/channel_api.html
const ld = require('lodash')
const amqplib = require('amqplib')

const defaultErrorHandler = err => { throw err }

const createAmqpChannel = async (userOptions = {}, errorHandler) => {
  const config = ld.defaultsDeep(
    {},
    userOptions,
    ld.pick(require('./defaults'), ['connection'])
  )
  const connection = await amqplib.connect(config.connection)
  console.log(`[amqp] connected to: ${config.connection}`)
  const channel = await connection.createChannel()

  channel.on('error', errorHandler || defaultErrorHandler)

  return channel
}

module.exports = { createAmqpChannel }
