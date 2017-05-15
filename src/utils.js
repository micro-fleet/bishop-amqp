const ld = require('lodash')
const { objectify } = require('bishop/src/utils')

module.exports = {

  defaultConfig(userConfig) {
    return ld.defaultsDeep({},
      userConfig || {},
      ld.pick(require('./defaults'), ['connection', 'appId', 'name', 'defExchangeOpts', 'defConsumerOpts'])
    )
  },

  // convert object { qwe: 'aaa', asd: 'bbb'} to string 'qwe.aaa.asd.bbb' with sorted keys
  routingKeyFromPattern(input) {
    const pattern = objectify(input)
    return Object.keys(pattern).sort().map(key => {
      const keyType = typeof pattern[key]
      const value = keyType === 'string' ? pattern[key] : '*'
      return `${key}.${value}`
    }).join('.')
  }

}
