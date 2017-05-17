/*
docker run --hostname my-rabbit \
 -e RABBITMQ_DEFAULT_USER=guest \
 -e RABBITMQ_DEFAULT_PASS=guest \
 -p 15672:15672 -p 5672:5672 \
 rabbitmq:3-management

*/

const { test } = require('ava')
const Bishop = require('bishop')
const transport = require(process.env.PWD)
const Promise = require('bluebird')


test('listen messages received over $notify', async t => {

  const bishop = new Bishop()
  await bishop.use(transport, {
    name: 'amqp-sample'
  })

  t.plan(3)
  const testMessage = 'done'

  bishop.add('role:test, act:eventemitter', () => {
    return testMessage
  })

  await bishop.follow('role:test', message => { // receive same message from 'local' and 'test'
    t.is(message, testMessage)
  })

  const result = await bishop.act('role:test, act:eventemitter', {
    $notify: ['local', 'amqp-sample']
  })
  t.is(result, testMessage)
  await Promise.delay(500) // wait till message arrive over amqp
})


test('ensure events are routed to correct listeners', async t => {
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

  await bishop.act('role: statistic, event: stop-watch, cmd: create')
  await bishop.act('role: statistic, event: stop-watch, cmd: create')
  await bishop.act('role: users, some:data, cmd: create')
  await bishop.act('role: users, cmd: create, other: option')
  await bishop.act('oops, role: users, cmd: create')

  await Promise.delay(500)
})
