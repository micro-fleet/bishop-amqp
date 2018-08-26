const crypto = require('crypto')
const Bishop = require('@fulldive/bishop')
const transport = require('../../')

const DEFAULT_TIMEOUT = 300

module.exports = { createAMQPClient, randomString, DEFAULT_TIMEOUT }

async function createAMQPClient(name, transportOptions = {}) {
  const bishop = new Bishop()
  await bishop.use(transport, { ...transportOptions, name })
  const act = async function($receiver, ...patterns) {
    const [basePattern] = patterns
    bishop.add(basePattern, name)
    return bishop.act(...patterns, { $receiver })
  }
  return [bishop, act]
}

function randomString(prefix = '') {
  return `${prefix}:${crypto.randomBytes(20).toString('hex')}`
}
