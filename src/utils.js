const ld = require('lodash')
const { objectify } = require('bishop/src/utils')
const amqp = require('amqp')
const Promise = require('bluebird')
const { URL } = require('url')

const defaultConfig = {
  name: '', // used to identify transport
  env: 'bishop', // used in exchange name
  driver: {
    defaultExchangeName: 'amq.topic',
    reconnect: true,
    reconnectBackoffStrategy: 'linear',
    reconnectBackoffTime: 1000
  },
  client: {
    name: '', // used in folow queue name
    version: '0.0.0'
  },
  connection: {
    host: 'localhost',
    port: 5672,
    heartbeat: 5,
    clientProperties: {}
  },
  followExchange: {
    type: 'topic',
    confirm: false
  },
  followQueue: {}
}

module.exports = {
  validateConfig(userConfig = {}) {
    const config = ld.defaultsDeep({}, userConfig, defaultConfig)
    if (!config.name) {
      throw new Error('option "config.name" is required')
    }
    if (!config.client.name) {
      throw new Error('unique "config.client.name" is required')
    }
    if (typeof config.connection === 'string') {
      config.connection = schemaFromUrl(config.connection)
    }
    config.connection.clientProperties = config.client
    return config
  },

  splitPattern(input, wild = '*') {
    const pattern = objectify(input)
    return Object.keys(pattern)
      .sort()
      .map(key => {
        const keyType = typeof pattern[key]
        const value = keyType === 'string' ? pattern[key] : wild
        return `${key}.${value}`
      })
  },

  createAmqpConnectionAsync(config, errorHandler = printError) {
    const connection = amqp.createConnection(config.connection, config.driver)
    connection.on('error', errorHandler)

    return new Promise(resolve => {
      connection.on('ready', () => resolve(connection))
    })
  }
}

function printError(err) {
  console.error('bishop amqp error:')
  console.error(err)
}

function schemaFromUrl(url) {
  const obj = new URL(url)
  if (obj.protocol !== 'amqp:') {
    throw new Error(`invalid amqp connecton string: ${url}`)
  }

  const schema = {
    host: obj.host,
    port: obj.port || 5672,
    heartbeat: 5,
    vhost: obj.pathname || '/',
    clientProperties: {}
  }
  if (obj.username) {
    schema.login = obj.username
  }
  if (obj.password) {
    schema.password = obj.password
  }

  if (schema.host.includes(',')) {
    schema.host = schema.host.split(',')
  }
  return schema
}
