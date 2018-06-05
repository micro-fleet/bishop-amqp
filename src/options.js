const Joi = require('joi')

const init = Joi.object({
  name: Joi.string()
    .min(1)
    .required(),
  env: Joi.string()
    .default('default')
    .description('Env value to split different env queues in one AMQP instance'),
  version: Joi.string().default('n/a'),
  timeout: Joi.number(),
  followExchange: Joi.string().default('bishop.follow'),
  amqp: Joi.object({
    // https://github.com/microfleet/transport-amqp/blob/HEAD/src/schema.js
    connection: Joi.alternatives().try(Joi.string(), Joi.object()),
    exchange: Joi.string().default('amq.topic')
  })
    .default()
    .options({ allowUnknown: true, stripUnknown: false })
})

const follow = Joi.object({
  queue: Joi.string()
})

module.exports = { init, follow }
