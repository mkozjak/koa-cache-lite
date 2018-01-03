'use strict'

const glob = require('../glob')

module.exports = class Memory {
  constructor(options) {
    this.cache = new Map()
    this.routeExpire = new Map()
    this.options = options

    if (options.debug) options._debug('using memory for caching')
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
      if (this.options.debug) this.options._debug('deleting from in-memory cache', key)

      // delete caching entry from cache on expiration
      if (this.cache.has(key)) this.cache.delete(key)
    }, (() => {
      if (timeout) return timeout
      else if (this.options.expireOpts.has(key)) return this.options.expireOpts.get(key)

      return this.options.defaultTimeout
    })()))

    if (this.options.debug) this.options._debug('setting new item in cache for url', key)
    return Promise.resolve(this.cache.set(key, value))
  }

  setMultiple(requestKey, params, timeout) {
    if (this.options.debug) this.options._debug('setting multiple items in cache for url', requestKey)

    for (let key of Object.keys(params)) {
      this.set(key, params[key], this.options.expireOpts.get(requestKey))
    }
  }

  remove(keys) {
    if (this.options.debug) this.options._debug('deleting from in-memory cache', keys)

    if (!keys) {
      this.cache = new Map()
      this.routeExpire = new Map()
      return
    }

    if (keys instanceof Array) {
      for (let key of keys) {
        this._delete(key)
      }
    }
    else this._delete(keys)
  }

  _delete(key) {
    if (glob.check(key) === false) {
      this.cache.delete(key)
      return
    }

    let re = glob.toRegExp(key)

    for (let cacheKey of this.cache) {
      if (re.test(cacheKey) === false)
        continue

      this.cache.delete(cacheKey[0])
    }
  }
}
