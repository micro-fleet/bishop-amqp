const { test } = require('ava')
const BB = require('bluebird')

const { createAMQPClient, randomString } = require('./fixtures')

test('timeout on RPC queue limit', async t => {
  const payload = randomString()
  const pattern = 'role:qos, cmd:rpc-queue, $timeout:10000'
  const responseDelayMs = 1000
  const messageCount = 10

  t.plan(messageCount + 1 + messageCount)

  const [limitedProducer] = await createAMQPClient('rpc-producer-limited', {
    amqp: { neck: 5 }
  })
  limitedProducer.add(pattern, async () => {
    await BB.delay(responseDelayMs)
    return payload
  })
  const [unlimitedProducer] = await createAMQPClient('rpc-producer-unlimited')
  unlimitedProducer.add(pattern, async () => {
    await BB.delay(responseDelayMs)
    return payload
  })

  // unlimited (qos=100) service, should handle messages in parallel
  const [, actUnlimited] = await createAMQPClient('rpc-consumer', {
    timeout: responseDelayMs * 2 // reduce timeout if issue fixed
  })
  await BB.map(new Array(messageCount), async () => {
    const result = await actUnlimited('rpc-producer-unlimited', pattern)
    t.is(result, payload)
  })

  // limited (qos=5) rpc will fail in low timeout
  const [, actTimeoutRestriction] = await createAMQPClient('rpc-consumer', {
    timeout: responseDelayMs * 2 // reduce timeout if issue fixed
  })
  await BB.map(new Array(messageCount), async () => {
    await actTimeoutRestriction('rpc-producer-limited', pattern)
  }).catch(err => {
    t.is(err.name, 'TimeoutError')
  })

  // limited (qos=5) rpc will success on greater timeout
  const [, actTimeoutUnrestricted] = await createAMQPClient('rpc-consumer', {
    timeout: messageCount * responseDelayMs // reduce timeout if issue fixed
  })
  await BB.map(new Array(messageCount), async () => {
    const result = await actTimeoutUnrestricted('rpc-producer-limited', pattern)
    t.is(result, payload)
  })
})
