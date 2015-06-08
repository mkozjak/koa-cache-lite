'use strict'

var expireOpts = new Map()
var defaultTimeout = 2000
var responseKeys = [ 'header', 'body' ]

module.exports = function(routes, opts) {
  if (opts.debug) console.info('cache options:', routes, opts.debug)

  var store = new Store(opts)

  return function *(next) {
    try {
      // check if no-cache is provided
      if (this.request.header['cache-control'] == 'no-cache') {
        return yield next
      }

      // check if HTTP methods other than GET are sent
      if (this.request.method != 'GET') {
        return yield next
      }

      let _url = this.request.url

      // return cached response
      let exists = yield store.has(_url)

      if (exists) {
        let item = yield store.get(_url)
        item = JSON.parse(item)
        if (opts.debug) console.info('returning from cache for url', _url)

        for (let key in item) {
          if (key == 'header') {
            let value = item[key]

            for (let hkey in value) {
              this.set(hkey, value[hkey])
            }

            continue
          }

          this[key] = item[key]
        }

        return
      }

      // check if route is permitted to be cached
      for (let route in routes) {
        if (this.request.path.indexOf(route) != -1) {
          let routeExpire = routes[route]

          if (routeExpire == false) {
            return yield next
          }

          if (isNaN(routeExpire) && (typeof routeExpire != Boolean)) {
            if (opts.debug) console.warn('invalid cache setting:', routeExpire)
            return yield next
          }

          // override default timeout
          expireOpts.set(this.request.path, routeExpire)
        }
      }

      // call next middleware and cache response on return
      yield next

      let _response = new Object()

      for (let key in this.response) {
        if (responseKeys.indexOf(key) != -1)
          _response[key] = this.response[key]
      }

      /*
      let entry = new Map()
      entry.set('data', _response)
      entry.set('timeout', setTimeout(function() {
        if (opts.debug) console.info('deleting from cache', _url)

        // delete caching entry from cache on expiration
        if (cache.has(_url)) cache.delete(_url, entry)
      }, function() {
        if (expireOpts.has(_url)) return expireOpts.get(_url)
        return defaultTimeout
      }()))
      */

      if (opts.debug) console.info('caching', _url)

      // set new caching entry
      store.set(_url, _response)
    }
    catch (error) {
      if (opts.debug) console.error(error)
      this.throw(error)
    }
  }
}

function Store(opts) {
  let type = opts.external ? opts.external.type : 'memory'
  let Driver = drivers[type]

  this.store = new Driver(opts.external || null)
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

function Memory() {
  let cache = new Map()
  let routeExpire = new Map()

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
      if (cache.has(key)) cache.delete(key, entry)
    }, function() {
      if (expireOpts.has(key)) return expireOpts.get(key)
      return defaultTimeout
    }()))

    return Promise.resolve(cache.set(key, value))
  }
}

function Redis(opts) {
  let conn = new (require('ioredis'))(opts.port || '127.0.0.1', opts.host || 6379)

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
    return conn.set(key, JSON.stringify(value)).then(function() {
      return conn.expire(key, function() {
        if (expireOpts.has(key)) return expireOpts.get(key) / 1000
        return defaultTimeout
      }())
    })
  }
}

var drivers = {
  'redis': Redis,
  'memory': Memory
}
