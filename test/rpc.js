const { test } = require('ava')
const Bishop = require('@fulldive/bishop')
const transport = require(process.env.PWD)

test('perform simple RPC calls', async t => {
  const consumer = new Bishop()
  const producer = new Bishop()

  const REMOTE_SUCCESS = 'remote request success'

  await consumer.use(transport, {
    name: 'rpc-consumer'
  })
  await producer.use(transport, {
    name: 'rpc-producer'
  })
  consumer.add('role:rpc, cmd:remote-request, $receiver:rpc-producer', 'rpc-consumer')
  producer.add('role:rpc, cmd:remote-request', () => REMOTE_SUCCESS)

  // remote requests succesful
  const result1 = await consumer.act('role:rpc, cmd:remote-request, respect:local')
  t.is(result1, REMOTE_SUCCESS)

  // request to non-existing pattern in existing remote service
  const error1 = await t.throws(consumer.act('role:rpc, cmd:remote-request-nosuch'))
  t.is(error1.message, 'pattern not found: role:rpc, cmd:remote-request-nosuch')

  // request to non-existing pattern in non-existing remote service
  const error2 = await t.throws(
    consumer.act('role:rpc, cmd:remote-request, $receiver:no-such-consumer')
  )
  t.is(error2.message, 'remote service does not exist on route rpc.no-such-consumer.default')
})

test('only one service gets RPC call', async t => {
  const consumer = new Bishop()
  const producer1 = new Bishop()
  const producer2 = new Bishop()

  const callQueue = []

  await consumer.use(transport, {
    name: 'single-consumer'
  })
  await producer1.use(transport, {
    name: 'single-producer'
  })
  await producer2.use(transport, {
    name: 'single-producer'
  })
  consumer.add('role:rpc, cmd:remote-request, $receiver:single-producer', 'single-consumer')
  producer1.add('role:rpc, cmd:remote-request', () => {
    callQueue.push('producer1')
    return 'producer1'
  })
  producer2.add('role:rpc, cmd:remote-request', () => {
    callQueue.push('producer2')
    return 'producer2'
  })

  // remote requests succesful
  const result = await consumer.act('role:rpc, cmd:remote-request, respect:local')
  t.is(callQueue.length, 1)
  t.is(callQueue[0], result)
})
