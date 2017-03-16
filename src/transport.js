// http://www.squaremobius.net/amqp.node/channel_api.html
const ld = require('lodash')
const amqplib = require('amqplib')

const defaultErrorHandler = err => { throw err }

const createAmqpChannel = async (userOptions = {}, errorHandler) => {
  const config = ld.defaultsDeep(
    {},
    ld.pick(require('./defaults'), ['connection']),
    userOptions
  )
  const connection = await amqplib.connect(config.connection)
  const channel = await connection.createChannel()

  channel.on('error', errorHandler || defaultErrorHandler)

  return channel
}

module.exports = { createAmqpChannel }
