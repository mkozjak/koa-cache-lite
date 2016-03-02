'use strict'

module.exports = class Memory {
  constructor(options) {
    this.cache = new Map()
    this.routeExpire = new Map()
    this.options = options

    if (options.debug) console.info('using memory for caching')
  }

  get(key) {
    return Promise.resolve(this.cache.get(key))
  }

  // wrapper convenience method
  getBuffer(key) {
    return Promise.resolve(this.cache.get(key))
  }

  has(key) {
    return Promise.resolve(this.cache.has(key))
  }

  set(key, value, timeout) {
    this.routeExpire.set(key, setTimeout(() => {
      if (this.options.debug) console.info('deleting from cache', key)

      // delete caching entry from cache on expiration
      if (this.cache.has(key)) this.cache.delete(key)
    }, () => {
      if (timeout) return timeout
      else if (this.options.expireOpts.has(key)) return this.options.expireOpts.get(key)

      return this.options.defaultTimeout
    }()))

    if (this.options.debug) console.info('setting new item in cache for url', key)
    return Promise.resolve(this.cache.set(key, value))
  }

  setMultiple(requestKey, params, timeout) {
    if (this.options.debug) console.info('setting multiple items in cache')

    for (let key of Object.keys(params)) {
      this.set(key, params[key], this.options.expireOpts.get(requestKey))
    }
  }

  remove(key) {
    if (this.options.debug) console.info('deleting from cache', key)
    if (this.cache.has(key)) this.cache.delete(key)
  }
}
