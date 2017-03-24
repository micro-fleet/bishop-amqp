module.exports = {
  name: 'amqp',                         // emitter
  appId: null,                          // emitter
  role: null,                           // specify one role: client, server (default: both)
  pattern: null,                        // [client]: automaticly bind specified pattern to transport if set
  queueName: null,                      // emitter: common services queue to listen incoming messages (will generate own if not set)
  routingKey: null,                     // [client/server]: routing key for incoming public messages
  connection: 'amqp://localhost',       // emitter
  defConsumerOpts: {                    // emitter
    noAck: false,
    priority: 10
  },
  defQueueOpts: {
    exclusive: false,
    durable: true,
    autoDelete: false,
    arguments: {
      maxPriority: 100,
      // maxLength: 100000 // old messages will be discarded
      // messageTtl: 100000 // message will be discarded after ms
      // deadLetterExchange: 'string' // then messages expired, rejected or nacked
    }
  },
  defExchangeOpts: {                     // emitter
    durable: true,      // will survive after server restart
    autoDelete: false   // do not delete if consumers are gone
    // alternateExchange: '' // send to this exchange if this one cant route
  },
  defPublishOpts: {
    // cc: [...], // send message copy to...
    persistent: true,
    mandatory: true // rabbitmq only, will send back if no binding found
  }
}
