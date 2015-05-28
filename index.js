'use strict'

var cache = new Map()
var expire = new Map()
var defaultTimeout = 2000
var responseKeys = [ 'header', 'body' ]

module.exports = function(routes, debug) {
  if (debug) console.info('cache options:', routes, debug)

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
      if (cache.has(_url)) {
        let item = cache.get(_url).get('data')

        if (debug) console.info('returning from cache', _url)

        for (let key of item.keys()) {
          if (key == 'header') {
            let value = item.get(key)

            for (let hkey in value) {
              this.set(hkey, value[hkey])
            }

            continue
          }

          this[key] = item.get(key)
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
            if (debug) console.warn('invalid cache setting:', routeExpire)
            return yield next
          }

          // override default timeout
          expire.set(this.request.path, routeExpire)
        }
      }

      // call next middleware and cache response on return
      yield next

      let _response = new Map()

      for (let key in this.response) {
        if (responseKeys.indexOf(key) != -1)
          _response.set(key, this.response[key])
      }

      let entry = new Map()
      entry.set('data', _response)
      entry.set('timeout', setTimeout(function() {
        if (debug) console.info('deleting from cache', _url)

        // delete caching entry from cache on expiration
        if (cache.has(_url)) cache.delete(_url, entry)
      }, function() {
        if (expire.has(_url)) return expire.get(_url)
        return defaultTimeout
      }()))

      if (debug) console.info('caching', _url)

      // set new caching entry
      cache.set(_url, entry)
    }
    catch (error) {
      if (debug) console.error(error)
      this.throw(error)
    }
  }
}
