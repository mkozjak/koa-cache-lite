'use strict'

module.exports = class Store {
  constructor(opts) {
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

    this.store = new (require('./drivers/' + type))(opts)

    if (type !== 'memory') {
      this.store.connect(opts || null)

      this.store.on('fail', () => {
        if (opts.debug)
          console.info('failed connecting to', type)

        if (opts.fallback) {
          this.store = new (require('./drivers/memory'))(opts || null)

          if (opts.debug)
            console.info('falling back to in-memory store')
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
}
