'use strict'

module.exports = class Store {
  constructor(options) {
    this.type = 'memory'

    if (options.external) {
      this.type = options.external.type
      options.host = options.external.host || '127.0.0.1'
      options.port = options.external.port || 6379
      options.password = options.external.password || null
      options.fallback = typeof options.external.fallback === 'boolean'
        ? options.external.fallback
        : true
      options.connectRetryCount = options.external.connectRetryCount || 5
      options.external = null
    }

    this.store = new (require('./drivers/' + this.type))(options)

    if (this.type !== 'memory') {
      this.store.connect(options || null)

      this.store.on('fail', () => {
        if (options.debug)
          options._debug('failed connecting to', this.type)

        if (options.fallback) {
          this.store = new (require('./drivers/memory'))(options || null)
          this.type = 'memory'

          if (options.debug)
            options._debug('falling back to in-memory store')
        }
      })
    }
  }

  get(key) {
    // returns a new Promise
    return this.store.get(key)
  }

  getBuffer(key) {
    // returns a new Promise
    return this.store.getBuffer(key)
  }

  has(key) {
    // returns a new Promise
    return this.store.has(key)
  }

  set(key, value, timeout) {
    // returns a new Promise
    return this.store.set(key, value, timeout)
  }

  setMultiple(params, timeout) {
    // returns a new Promise
    return this.store.setMultiple(params, timeout)
  }

  remove(key) {
    // returns a new Promise
    return this.store.remove(key)
  }

  storeType() {
    return this.type
  }
}
