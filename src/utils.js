module.exports = {

  // convert object { qwe: 'aaa', asd: 'bbb'} to string 'qwe.aaa.asd.bbb' with sorted keys
  routingKeyFromPattern(pattern) {
    return Object.keys(pattern).sort().map(key => {
      const keyType = typeof pattern[key]
      const value = keyType === 'string' ? pattern[key] : '*'
      return `${key}.${value}`
    }).join('.')
  }

}
