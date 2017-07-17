const ld = require('lodash')
const { objectify } = require('bishop/src/utils')
const amqp = require('amqp')
const Promise = require('bluebird')


const driverDefaults = {
  defaultExchangeName: 'amq.topic',
  reconnect: true,
  reconnectBackoffStrategy: 'linear',
  reconnectBackoffTime: 1000,
}

const connectionDefaults = {
  // host: [
  //   'rabbitmq-0.rabbitmq.default.svc.cluster.local',
  //   'rabbitmq-1.rabbitmq.default.svc.cluster.local',
  //   'rabbitmq-2.rabbitmq.default.svc.cluster.local',
  // ],
  host: 'localhost',
  port: 5672,
  // login: 'admin',
  // password: 'HgKn96UufE',
  heartbeat: 5, // in sec
  // clientProperties: {
  //   serviceName: 'app-name',
  //   serviceVersion: '0.1.2'
  // }
}


// const configRequiredFields = ['connection', 'name', 'appId']

const defaultConfig = {
  driver: {
    defaultExchangeName: 'amq.topic',
    reconnect: true,
    reconnectBackoffStrategy: 'linear',
    reconnectBackoffTime: 1000
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
  followQueue: {

  }
}

module.exports = {

  validateConfig(userConfig = {}) {
    const config = ld.defaultsDeep({}, userConfig, defaultConfig)
    const { name, version = '0.0.0' } = config
    if (!name) {
      throw new Error('option "config.name" is required')
    }
    config.connection.clientProperties = { serviceName: name, serviceVersion: version }
    return config
  },

  splitPattern(input, wild = '*') {
    const pattern = objectify(input)
    return Object.keys(pattern).sort().map(key => {
      const keyType = typeof pattern[key]
      const value = keyType === 'string' ? pattern[key] : wild
      return `${key}.${value}`
    })
  },

  createAmqpConnectionAsync(config, errorHandler = console.error) {
    const connection = amqp.createConnection(config.connection, config.driver)
    connection.on('error', errorHandler)

    return new Promise(resolve => {
      connection.on('ready', () => resolve(connection))
    })
  }

}
