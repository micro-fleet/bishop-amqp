const { test } = require('ava')
const Bishop = require('@fulldive/bishop')
const transport = require(process.env.PWD)

test('perform RPC call', async t => {
  const consumer = new Bishop()
  const producer = new Bishop()

  await consumer.use(transport, {
    name: 'consumer'
  })
  consumer.add('role:rpc, $receiver:producer', 'consumer')

  await producer.use(transport, {
    name: 'producer'
  })

  producer.add('role:rpc, cmd:call', () => 'rpc success')
  const result = await consumer.act('role:rpc, cmd:call, $timeout:10000, qwe:asd')
  console.log(result)
  t.pass()
})
