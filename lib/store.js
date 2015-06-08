'use strict'

function Store(opts) {
  let type = 'memory'

  if (opts.external) {
    type = opts.external.type
    opts.host = opts.external.host || '127.0.0.1'
    opts.port = opts.external.port || 6379
    opts.external = null
  }

  this.store = new (require('./drivers/' + type))(opts || null)
}

Store.prototype.get = function(key) {
  // returns a new Promise
  return this.store.get(key)
}

Store.prototype.has = function(key) {
  // returns a new Promise
  return this.store.has(key)
}

Store.prototype.set = function(key, value, timeout) {
  // returns a new Promise
  return this.store.set(key, value, timeout)
}

module.exports = Store
