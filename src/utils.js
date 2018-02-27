const crypto = require('crypto')

// const Promise = require('bluebird')
// const { URL } = require('url')

module.exports = { splitPattern, uniqueFollowQueueName }

function text2obj(input) {
  return input.split(',').reduce((prev, cur) => {
    let [key, value] = cur.trim().split(':')
    prev[key.trim()] = value.trim()
    return prev
  }, {})
}

function splitPattern(input, wild = '*') {
  const pattern = typeof input === 'string' ? text2obj(input) : input
  return Object.keys(pattern)
    .sort()
    .map(key => {
      const keyType = typeof pattern[key]
      const value = keyType === 'string' ? pattern[key] : wild
      return `${key}.${value}`
    })
}

function uniqueFollowQueueName(routingKey, ...clientParts) {
  const queueId = crypto
    .createHash('md5')
    .update(routingKey)
    .digest('hex')
  return [...clientParts, queueId].join('.')
}

// function schemaFromUrl(url) {
//   const obj = new URL(url)
//   if (obj.protocol !== 'amqp:') {
//     throw new Error(`invalid amqp connecton string: ${url}`)
//   }

//   const schema = {
//     host: obj.host,
//     port: obj.port || 5672,
//     heartbeat: 5,
//     vhost: obj.pathname || '/',
//     clientProperties: {}
//   }
//   if (obj.username) {
//     schema.login = obj.username
//   }
//   if (obj.password) {
//     schema.password = obj.password
//   }

//   if (schema.host.includes(',')) {
//     schema.host = schema.host.split(',')
//   }
//   return schema
// }
