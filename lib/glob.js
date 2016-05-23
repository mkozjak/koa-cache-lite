'use strict'

module.exports.check = function(pattern) {
  if (typeof pattern === 'string' && /[*!?{}(|)[\]]/.test(pattern))
    return true

  return false
}
