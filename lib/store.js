'use strict'

function Store(opts) {
  var self = this
  let type = 'memory'

  if (opts.external) {
    type = opts.external.type
    opts.host = opts.external.host || '127.0.0.1'
    opts.port = opts.external.port || 6379
    opts.password = opts.external.password || null
    opts.fallback = typeof opts.external.fallback === 'boolean'
      ? opts.external.fallback
      : true
    opts.external = null
  }

  // this.store = new (require('./drivers/' + type))(opts || null)
  this.store = new (require('./drivers/' + type))
  this.store.connect(opts || null)

  this.store.on('fail', function() {
    if (opts.debug)
      console.info('failed connecting to', type)

    if (opts.fallback) {
      self.store = new (require('./drivers/memory'))(opts || null)

      if (opts.debug)
        console.info('falling back to in-memory store')
    }
  })
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

Store.prototype.delete = function(key) {
  // returns a new Promise
  return this.store.delete(key)
}

module.exports = Store
