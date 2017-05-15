module.exports = {
  emitter: require('./src/emitter'),
  transport: require('./src/transport'),
  createAmqpTransportAsync: require('./src')
}
