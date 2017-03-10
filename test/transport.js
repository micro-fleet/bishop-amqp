// /*
// docker run --hostname my-rabbit \
//  -e RABBITMQ_DEFAULT_USER=guest \
//  -e RABBITMQ_DEFAULT_PASS=guest \
//  -p 15672:15672 -p 5672:5672 \
//  rabbitmq:3-management
//
// */

const { test } = require('ava')
const Bishop = require('bishop')
const Promise = require('bluebird')
const transport = require(process.env.PWD)

test('test', async t => {
  const bishop = new Bishop()
  await bishop.use(transport, {
    roles: ['emitter']
  })
  bishop.add('role:test, act:eventemitter, some, parameters', () => {
    return 'done'
  })
  const res = await bishop.act('role:test, act:eventemitter, some: arg, parameters: true')
  console.log(res)
})
// test('test', async t => {
//   const bishopServer = new Bishop()
//   const bishopClient = new Bishop()
//
//   await bishopClient.use(transport, {
//     name: 'amqp-client',
//     routingKey: 'some.stuff',
//     pattern: 'some:stuff',
//     role: 'client'
//   })
//   await bishopServer.use(transport, {
//     name: 'amqp-server',
//     routingKey: 'some.stuff',
//     pattern: 'some:stuff',
//     role: 'server'
//   })
//   bishopServer.add('some:stuff', () => 'hello')
//   await bishopClient.act('some:stuff, with:stuff')
//
//   await Promise.delay(500)
// })
