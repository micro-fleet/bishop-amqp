const Joi = require('joi')

const init = Joi.object({
  name: Joi.string()
    .min(1)
    .required(),
  env: Joi.string().description('Env value to split different env queues in one AMQP instance'),
  version: Joi.string().default('n/a'),
  timeout: Joi.number().default(10000),
  amqp: Joi.object({
    // https://github.com/microfleet/transport-amqp/blob/HEAD/src/schema.js
    private: Joi.boolean().default(true),
    exchange: Joi.string().default('amq.topic')
  }).default()
})

const follow = Joi.object({
  queue: Joi.string()
})

module.exports = { init, follow }
