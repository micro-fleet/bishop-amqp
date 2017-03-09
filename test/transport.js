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

// /*
// { heartbeat: '10000',
//   reconnect: 'true',
//   reconnectDelayTime: '1000',
//   hostRandom: 'false',
//   connectTimeout: '30000',
//   clientProperties: '...',
//   ssl: 'false',
//   sslOptions: '...',
//   temporaryChannelTimeout: '2000',
//   noDelay: 'true',
//   proto: 'amqp:',
//   host: 'localhost',
//   port: '5672',
//   path: '/',
//   login: 'guest',
//   password: 'guest' }
//  */
//
test('test', async t => {
  const bishop = new Bishop()
  await bishop.use(transport)
  await Promise.delay(500)
})
