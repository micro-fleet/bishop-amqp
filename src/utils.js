const crypto = require('crypto')
const { URL } = require('url')

const { createTraceSpan, finishSpan } = require('@fulldive/common/src/tracer')

module.exports = { splitPattern, uniqueQueueName, objectifyConnectionUrl, creteFollowRouter }

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

/**
 * Generate string from passed parameters starting from the second argument and divided by dot
 * If routingKey is passed - it will be converted to the hash and appended to string
 * Examples:
 * - follow.amqp.default
 * - follow.amqp.default.38eec02377875dce28eaef0692d7f4fc
 */
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

function creteFollowRouter({ tracer, listener }) {
  // https://github.com/microfleet/transport-amqp/blob/69db5cef19d9e09f15a40b7dbc7891b5d9dbcb73/src/amqp.js#L101
  // https://medium.com/ibm-watson-data-lab/handling-failure-successfully-in-rabbitmq-22ffa982b60f
  return function router(_message, properties, raw) {
    const headers = properties.headers || {}
    let { bishopHeaders } = headers || {}
    let message
    // backward compatibility with previous bishop version (June 2018)
    if (!bishopHeaders) {
      const [realMessage, _bishopHeaders] = _message
      message = realMessage
      bishopHeaders = _bishopHeaders
    } else {
      bishopHeaders = JSON.parse(bishopHeaders)
      message = _message
    }

    const span = createTraceSpan(tracer, 'follow:handler', bishopHeaders.trace)
    span.setTag('bishop.follow.pattern', bishopHeaders.pattern)
    span.setTag('bishop.follow.source', bishopHeaders.source)
    console.log('1', 'got follow message')
    ;(async () => {
      try {
        console.log('2', 'execute listener')
        console.log(listener.toString())
        const result = await listener(message, bishopHeaders)
        console.log('3', 'listener exited sucessfully:', result)
      } catch (err) {
        console.log('3 caught error:', err)
        process.exit()
      }
    })()
    // listener(message, bishopHeaders)
    //   .catch(err => {
    //     // 2do: test against error
    //     const requeueMessage = !properties.redelivered
    //     console.log(1, 'parse')
    //     if (requeueMessage) {
    //       // resend message one more time
    //       console.log(2, 'retry')
    //       raw.retry()
    //       span.setTag('bishop.follow.action', 'requeued')
    //     } else {
    //       console.log(3, 'reject')
    //       // the message was requeued once - reject it (send to dead letter exchange)
    //       raw.reject()
    //       span.setTag('bishop.follow.action', 'rejected')
    //     }
    //     finishSpan(span, err)
    //     throw err
    //   })
    //   .then(result => {
    //     console.log(4, 'ack', result)
    //     raw.ack() // mark message as processed
    //     span.setTag('bishop.follow.action', 'processed')
    //     finishSpan(span)
    //     return result
    //   })
  }
}
