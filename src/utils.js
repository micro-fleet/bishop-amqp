module.exports = {

  routingKeyFromPattern(pattern) {
    const arrKeys = pattern instanceof Object ? Object.keys(pattern) :
      pattern.split(',').map(item => item.trim()).filter(item => !!item)

    return arrKeys.sort().join('.')
  }

}
