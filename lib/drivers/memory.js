'use strict'

module.exports = function(opts) {
  let cache = new Map()
  let routeExpire = new Map()
  if (opts.debug) console.info('using memory for caching')

  this.get = function(key) {
    return Promise.resolve(cache.get(key))
  }

  this.has = function(key) {
    return Promise.resolve(cache.has(key))
  }

  this.set = function(key, value, timeout) {
    routeExpire.set(key, setTimeout(function() {
      if (opts.debug) console.info('deleting from cache', key)

      // delete caching entry from cache on expiration
      if (cache.has(key)) cache.delete(key)
    }, function() {
      if (opts.expireOpts.has(key)) return opts.expireOpts.get(key)
      return opts.defaultTimeout
    }()))

    if (opts.debug) console.info('setting new item in cache for url', key)
    return Promise.resolve(cache.set(key, value))
  }

  this.delete = function(key) {
    if (opts.debug) console.info('deleting from cache', key)
    if (cache.has(key)) cache.delete(key)
  }

}
