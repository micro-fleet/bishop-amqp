const { objectify } = require('bishop/src/utils')
module.exports = {

  routingKeyFromPattern(pattern) {
    const obj = objectify(pattern)
    return Object.keys(obj).sort().join('.')
  }

}
