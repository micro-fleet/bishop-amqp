const ld = require('lodash')
const { objectify } = require('bishop/src/utils')

module.exports = {

  defaultConfig(userConfig) {
    return ld.defaultsDeep({},
      userConfig || {},
      ld.pick(require('./defaults'), ['connection', 'appId', 'name', 'defExchangeOpts', 'defConsumerOpts', 'eventsQueueName'])
    )
  },

  patternPieces(input, wild = '*') {
    const pattern = objectify(input)
    return Object.keys(pattern).sort().map(key => {
      const keyType = typeof pattern[key]
      const value = keyType === 'string' ? pattern[key] : wild
      return `${key}.${value}`
    })
  }

}
