const { test } = require('ava')
const { createAMQPClient, randomString } = require('./fixtures')

test('perform simple RPC calls', async t => {
  const payload = randomString()

  const [, act] = await createAMQPClient('rpc-consumer')
  const [producer] = await createAMQPClient('rpc-producer')

  producer.add('role:rpc, cmd:remote-request', () => payload)

  // remote requests succesful
  const result1 = await act('rpc-producer', 'role:rpc, cmd:remote-request, respect:local')
  t.is(result1, payload)

  // request to non-existing pattern in existing remote service
  const errorNotFoundPattern = await t.throws(
    act('rpc-producer', 'role:rpc, cmd:remote-request-nosuch')
  )
  t.is(errorNotFoundPattern.name, 'NotFoundError')

  // request to non-existing pattern in non-existing remote service
  const errorNotFoundService = await t.throws(
    act('rpc-producer-nonexising', 'role:rpc, cmd:remote-request')
  )
  t.is(errorNotFoundService.name, 'AMQP_BasicReturnError')
  t.is(errorNotFoundService.code, 'ERR_AMQP_BASIC_RETURN')
})

test('only one service gets RPC call', async t => {
  const callQueue = []

  const [, act] = await createAMQPClient('single-consumer')
  const [producer1] = await createAMQPClient('single-producer')
  const [producer2] = await createAMQPClient('single-producer')

  producer1.add('role:rpc, cmd:remote-request', () => {
    callQueue.push('producer1')
    return 'producer1'
  })
  producer2.add('role:rpc, cmd:remote-request', () => {
    callQueue.push('producer2')
    return 'producer2'
  })

  // remote requests succesful
  const result = await act('single-producer', 'role:rpc, cmd:remote-request, respect:local')
  t.is(callQueue.length, 1)
  t.is(callQueue[0], result)
})
