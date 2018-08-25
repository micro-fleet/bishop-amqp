const crypto = require('crypto')
const Bishop = require('@fulldive/bishop')
const transport = require('../../')

module.exports = { createAMQPClient, randomString }

async function createAMQPClient(name, transportOptions = {}) {
  const bishop = new Bishop()
  console.log({ ...transportOptions, name })
  await bishop.use(transport, { ...transportOptions, name })
  const act = async function($receiver, ...patterns) {
    const [basePattern] = patterns
    bishop.add(basePattern, name)
    return bishop.act(...patterns, { $receiver })
  }
  return [bishop, act]
}

function randomString() {
  return crypto.randomBytes(20).toString('hex')
}
