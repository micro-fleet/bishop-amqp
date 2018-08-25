const { test } = require('ava')
const Bishop = require('@fulldive/bishop')
const transport = require(process.env.PWD)
const BB = require('bluebird')

const { createAMQPClient, randomString } = require('./fixtures')

test.serial('listen messages received over $notify', async t => {
  const bishop = new Bishop()
  await bishop.use(transport, {
    name: 'amqp-sample'
  })

  t.plan(4)
  const testMessage = Math.random()

  bishop.add('role:test, act:eventemitter', () => {
    t.pass()
    return testMessage
  })

  await bishop.follow('role:test, $queue: test1-1', message => {
    // receive same message twice (from 'local' and amqp)
    t.is(message, testMessage)
  })

  const result = await bishop.act('role:test, act:eventemitter', {
    $notify: ['local', 'amqp-sample']
  })
  t.is(result, testMessage)
  await Promise.delay(500) // wait till message arrive over amqp
})

test.serial('ensure events are routed to correct listeners', async t => {
  t.plan(5)

  const bishop = new Bishop()
  await bishop.use(transport, {
    name: 'amqp-sample2'
  })

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

  await Promise.delay(300)
})

test.serial('check valid serialization of undefined', async t => {
  t.plan(1)

  const producer = new Bishop()
  await producer.use(transport, {
    name: 'amqp'
  })
  const consumer = new Bishop()
  await consumer.use(transport, {
    name: 'amqp'
  })
  producer.add('role:test-serialize, $notify:amqp', async () => {})

  await consumer.follow('role:test-serialize', message => {
    t.is(message, null)
  })

  await producer.act('role:test-serialize')

  await Promise.delay(300)
})

test.serial('ensure messages are routed between instances correctly', async t => {
  t.plan(3)
  const emitter = new Bishop()
  const consumer1 = new Bishop()
  const consumer2 = new Bishop()

  await emitter.use(transport, { name: 'amqp' })
  await consumer1.use(transport, {
    name: 'amqp'
  })
  await consumer2.use(transport, {
    name: 'amqp'
  })

  emitter.add(
    'role: test, cmd: fake, additional: arguments, $notify: amqp',
    () => 'command executed'
  )

  const messages = []

  // consumer1 OR consumer2 should receive message due to same queue
  await consumer1.follow('role: test, cmd: fake, $queue: test3-1', () => {
    messages.push(1)
  })
  await consumer2.follow('role: test, cmd: fake, $queue: test3-1', () => {
    messages.push(2)
  })

  // consumer1 should receive message due to other queue name
  await consumer1.follow('role: test, cmd: fake, $queue: test3-2', () => {
    t.pass()
  })

  // consumer1 should receive message due to other queue name
  await consumer1.follow('role: test, cmd, $queue: test3-3', () => {
    t.pass()
  })

  await emitter.act('role: test, cmd: fake, additional: arguments')
  await Promise.delay(500)
  t.is(messages.length, 1)
})
