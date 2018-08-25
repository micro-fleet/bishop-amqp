const { test } = require('ava')
const BB = require('bluebird')

const { createAMQPClient, randomString } = require('./fixtures')

test('requeue message', async t => {
  t.plan(3)
  const pattern = 'role:test, act:qos-requeue'
  const payload = randomString()
  const [producer] = await createAMQPClient('amqp-requeue-producer')
  const [, act] = await createAMQPClient('amqp-requeue-consumer')
  const [follower1] = await createAMQPClient('amqp-requeue-follower')
  const [follower2] = await createAMQPClient('amqp-requeue-follower')

  producer.add(`${pattern}, $notify:amqp-requeue-producer`, () => payload)

  await follower1.follow(pattern, message => {
    t.is(message, payload)
    throw new Error('should requeue this message')
  })

  // should receive same message again
  await follower2.follow(pattern, message => {
    t.is(message, payload)
  })

  const result = await act('amqp-requeue-producer', pattern)
  t.is(result, payload)
  await BB.delay(100)
})

test('reject message', async t => {
  const messages = []
  t.plan(3)
  const pattern = 'role:test, act:qos-reject'
  const payload = randomString()
  const [producer] = await createAMQPClient('amqp-reject-producer')
  const [, act] = await createAMQPClient('amqp-reject-consumer')
  const [follower1] = await createAMQPClient('amqp-reject-follower')
  const [follower2] = await createAMQPClient('amqp-reject-follower')

  producer.add(`${pattern}, $notify:amqp-reject-producer`, () => payload)

  await follower1.follow(pattern, message => {
    t.is(message, payload)
    messages.push(message)
    throw new SyntaxError('should reject this message')
  })

  // should not receive same message again
  await follower2.follow(pattern, message => {
    messages.push(message)
  })

  const result = await act('amqp-reject-producer', pattern)
  t.is(result, payload)
  t.is(messages.length, 1)
  await BB.delay(100)
})
