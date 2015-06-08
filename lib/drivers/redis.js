'use strict'

var Redis = require('ioredis')

module.exports = function(opts) {
  let conn = new Redis(opts.port || '127.0.0.1', opts.host || 6379)

  this.get = function(key) {
    return conn.get(key)
  }

  this.has = function(key) {
    return conn.exists(key).then(function(check) {
      if (check > 0) return Promise.resolve(true)
      else return Promise.resolve(false)
    })
  }

  this.set = function(key, value, timeout) {
    if (opts.debug) console.info('setting new item in cache for url', key)

    return conn.set(key, JSON.stringify(value)).then(function() {
      return conn.expire(key, function() {
        if (opts.expireOpts.has(key)) return opts.expireOpts.get(key) / 1000
        return defaultTimeout / 1000
      }())
    })
  }
}
