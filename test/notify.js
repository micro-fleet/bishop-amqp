const { test } = require('ava')
const BB = require('bluebird')

const { createAMQPClient, randomString, DEFAULT_TIMEOUT } = require('./fixtures')

test('listen messages received over $notify', async t => {
  const payload = randomString('notify')
  const [bishop] = await createAMQPClient('amqp-sample')

  t.plan(4)

  bishop.add('role:test, cmd:basic, act:eventemitter', () => {
    t.pass()
    return payload
  })

  await bishop.follow('role:test, cmd:basic, $queue: test1-1', message => {
    // receive same message twice (from 'local' and amqp)
    t.is(message, payload)
  })

  const result = await bishop.act('role:test, cmd:basic, act:eventemitter', {
    $notify: ['local', 'amqp-sample']
  })
  t.is(result, payload)
  await BB.delay(DEFAULT_TIMEOUT) // wait till message arrive over amqp
})

test('ensure events are routed to correct listeners', async t => {
  t.plan(5)
  const [bishop] = await createAMQPClient('amqp-sample2')

  bishop.add('role: statistic, event: stop-watch, cmd: create, $notify: amqp-sample2', () => {
    return 'valid-emitter-1'
  })

  bishop.add('role: users, cmd: create, $notify: amqp-sample2', () => {
    return 'valid-emitter-2'
  })

  bishop.add('role: users, cmd: create, onemore: true, $notify: amqp-sample2', () => {
    return 'invalid-emitter-1'
  })

  bishop.add('role: users, $notify: amqp-sample2', () => {
    return 'invalid-emitter-2'
  })

  await bishop.follow('role: statistic, event: stop-watch', message => {
    t.is(message, 'valid-emitter-1')
  })

  await bishop.follow('role: users, cmd', message => {
    t.is(message, 'valid-emitter-2')
  })

  await bishop.act('role: statistic, event: stop-watch, cmd: create', {
    someshit: undefined // test against unsupported fields
  })
  await bishop.act('role: statistic, event: stop-watch, cmd: create')
  await bishop.act('role: users, some:data, cmd: create')
  await bishop.act('role: users, cmd: create, other: option')
  await bishop.act('oops, role: users, cmd: create')

  await BB.delay(DEFAULT_TIMEOUT)
})

test('check valid serialization of undefined', async t => {
  t.plan(1)

  const [producer, act] = await createAMQPClient('amqp-undefined')
  const [consumer] = await createAMQPClient('amqp-undefined')

  producer.add('role:test-serialize, $notify:amqp-undefined', async () => {})

  await consumer.follow('role:test-serialize', message => {
    t.is(message, null)
  })

  await act('amqp-undefined', 'role:test-serialize')
  await BB.delay(DEFAULT_TIMEOUT)
})

test('ensure messages are routed between instances correctly', async t => {
  t.plan(4)

  const payload = randomString('routing')
  const [emitter] = await createAMQPClient('amqp-test-routing')
  const [consumer1] = await createAMQPClient('amqp-test-routing')
  const [consumer2] = await createAMQPClient('amqp-test-routing')

  emitter.add(
    'role:routing, cmd: fake, additional: arguments, $notify: amqp-test-routing',
    () => payload
  )

  const messages = []

  // consumer1 OR consumer2 should receive message due to same queue
  await consumer1.follow('role:routing, cmd: fake, $queue: amqp-test3-1', message => {
    messages.push(message)
  })
  await consumer2.follow('role:routing, cmd: fake, $queue: amqp-test3-1', message => {
    messages.push(message)
  })

  // consumer1 should receive message due to other queue name
  await consumer1.follow('role:routing, cmd: fake, $queue: amqp-test3-2', message => {
    t.is(message, payload)
  })

  // consumer1 should receive message due to other queue name
  await consumer1.follow('role:routing, cmd, $queue: amqp-test3-3', message => {
    t.is(message, payload)
  })

  await emitter.act('role:routing, cmd: fake, additional: arguments')
  await BB.delay(DEFAULT_TIMEOUT)
  t.is(messages.length, 1)
  t.is(messages[0], payload)
})
