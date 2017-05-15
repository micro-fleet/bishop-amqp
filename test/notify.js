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

  const bishop = new Bishop({
    ignoreSameMessage: false
  })
  await bishop.use(transport, {
    name: 'test'
  })

  t.plan(3)
  const testMessage = 'done'

  bishop.add('role:test, act:eventemitter', () => {
    return testMessage
  })

  bishop.follow('role:test', message => { // receive same message from 'local' and 'amqp' due to 'ignoreSameMessage'
    t.is(message, testMessage)
  })

  const result = await bishop.act('role:test, act:eventemitter, $notify: true')
  t.is(result, testMessage)
  await Promise.delay(50) // wait till message arrive over amqp
})
