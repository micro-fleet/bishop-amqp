const crypto = require('crypto')
const { URL } = require('url')

module.exports = { splitPattern, uniqueQueueName, objectifyConnectionUrl }

function text2obj(input) {
  return input.split(',').reduce((prev, cur) => {
    let [key, value] = cur.trim().split(':')
    prev[key.trim()] = value.trim()
    return prev
  }, {})
}

function objectifyConnectionUrl(url) {
  if (typeof url !== 'string') {
    return url
  }
  const obj = new URL(url)
  if (obj.protocol !== 'amqp:') {
    throw new Error(`invalid amqp connecton string: ${url}`)
  }

  const schema = {
    host: obj.host,
    port: obj.port || 5672,
    vhost: obj.pathname || '/'
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

function uniqueQueueName(routingKey, ...clientParts) {
  const queueParts = [...clientParts]
  if (routingKey) {
    queueParts.push(
      crypto
        .createHash('md5')
        .update(routingKey)
        .digest('hex')
    )
  }
  return queueParts.join('.')
}
