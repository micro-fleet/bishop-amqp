/*
docker run --hostname my-rabbit \
 -e RABBITMQ_DEFAULT_USER=guest \
 -e RABBITMQ_DEFAULT_PASS=guest \
 -p 15672:15672 -p 5672:5672 \
 rabbitmq:3-management

*/

const { test } = require('ava')
const Bishop = require('bishop')
const { createAmqpTransportAsync } = require(process.env.PWD)
const Promise = require('bluebird')


test('listen messages received over $notify', async t => {

  t.plan(3)
  const testMessage = 'done'
  const bishop = new Bishop()
  const amqpTransport = await createAmqpTransportAsync()

  bishop.register('transport', 'amqp', amqpTransport)

  bishop.add('role:test, act:eventemitter', () => {
    return testMessage
  })

  bishop.follow('role:test', message => { // receive message from 'local' and 'amqp'
    t.is(message, testMessage)
  })

  const result = await bishop.act('role:test, act:eventemitter, $notify: true')
  t.is(result, testMessage)
  await Promise.delay(50) // wait till message arrive over amqp
})
