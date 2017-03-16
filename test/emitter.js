/*
docker run --hostname my-rabbit \
 -e RABBITMQ_DEFAULT_USER=guest \
 -e RABBITMQ_DEFAULT_PASS=guest \
 -p 15672:15672 -p 5672:5672 \
 rabbitmq:3-management

*/

const { test } = require('ava')
const Bishop = require('bishop')
const amqp = require(process.env.PWD)
const Promise = require('bluebird')

const { createEventEmitter, setMessageAsEmittable, createEventListener } = amqp.emitter

test('emit messages over subscripion', async t => {
  t.plan(3)

  const testMessage = 'done'
  const bishop = new Bishop()

  bishop.register('before', 'role:test', setMessageAsEmittable)
  bishop.register('after', await createEventEmitter())

  const listener = await createEventListener()
  listener.on('role, act', (message, headers) => {
    t.is(message, testMessage)
    t.deepEqual(headers, {
      pattern: { role: 'test', act: 'eventemitter', some: {}, parameters: {} },
      routingKey: 'act.parameters.role.some'
    })
  })


  bishop.add('role:test, act:eventemitter, some, parameters', () => {
    return testMessage
  })

  t.is(await bishop.act('role:test, act:eventemitter, some: arg, parameters: true'), 'done')
  await Promise.delay(50) // wait till message arrive over amqp
})
