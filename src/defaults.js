module.exports = {
  name: 'amqp',                         //
  eventsQueueName: 'bishop.events',
  appId: null,                          // application unique id (generate unique queues)
  queueName: null,                      // common services queue to listen incoming messages (will generate own if not set)
  connection: 'amqp://localhost',
  defConsumerOpts: {
    noAck: true,                        // do not wait for confirmation of message by default
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
