const Joi = require('joi')

const schema = Joi.object({
  name: Joi.string()
    .min(1)
    .required(),
  env: Joi.string()
    .default('default')
    .description('Env value to split different environments in one AMQP instance'),
  version: Joi.string().default('n/a'),
  timeout: Joi.number(),
  followExchange: Joi.string().default('bishop.events'),
  followQueueOpts: Joi.object({
    queue: Joi.string(),
    autoDelete: Joi.boolean().default(false, 'do not delete queue if no consumers left'),
    durable: Joi.boolean().default(true, 'survive restarts & use disk storage'),
    arguments: Joi.object({
      'x-expires': Joi.number()
        .min(0)
        .default(1000 * 60 * 60 * 24, 'delete the follow queue after its been unused for 1 day')
    }).default()
  })
    .description('default options for bishop.follow queues')
    .default(),
  amqp: Joi.object({
    // https://github.com/microfleet/transport-amqp/blob/HEAD/src/schema.js
    connection: Joi.alternatives().try(Joi.string(), Joi.object()),
    exchange: Joi.string().default('amq.topic')
  })
    .default()
    .options({ allowUnknown: true, stripUnknown: false })
})

module.exports = schema
