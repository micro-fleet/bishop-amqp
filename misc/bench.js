const Promise = require('bluebird')
const Benchmark = require('benchmark')
const AMQPTransport = require('@microfleet/transport-amqp')
const fmt = require('util').format

const configuration = {
  exchange: 'amq.topic',
  neck: 10000,
  defaultQueueOpts: {
    autoDelete: true
  },
  privateQueueOpts: {
    autoDelete: true
  }
}

// simple back-forth
function listener(message, headers, actions, callback) {
  callback(null, 'ok')
  actions.ack()
}

// opts for consumer
const opts = Object.assign({}, configuration, {
  queue: 'tq',
  listen: 'tq'
})

// publisher
const publisher = new AMQPTransport(configuration)
let messagesSent = 0

Promise.join(
  AMQPTransport.connect(
    opts,
    listener
  ),
  publisher.connect()
).spread(consumer => {
  const suite = new Benchmark.Suite('RabbitMQ')
  suite
    .add('Round-trip', {
      defer: true,
      fn: async function test(deferred) {
        await publisher.sendAndWait('tq', 'tq')
        messagesSent += 1
        deferred.resolve()
      }
    })
    .on('complete', function suiteCompleted() {
      const stats = this.filter('fastest')[0].stats
      const times = this.filter('fastest')[0].times
      process.stdout.write(fmt('Messages sent: %s\n', messagesSent))
      process.stdout.write(fmt('Mean is %s ms ~ %s %\n', stats.mean * 1000, stats.rme))
      process.stdout.write(fmt('Total time is %s s %s s\n', times.elapsed, times.period))
      consumer.close()
      publisher.close()
    })
    .run({ async: false, defer: true })
})
