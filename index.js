'use strict'

var Store = require('./lib/store')
var responseKeys = [ 'header', 'body' ]

module.exports = function(routes, opts) {
  if (opts.debug) console.info('cache options:', routes, opts.debug)

  opts.expireOpts = new Map()
  opts.defaultTimeout = 5000
  var store = new Store(opts)

  return function *(next) {
    try {
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
          opts.expireOpts.set(this.request.path, routeExpire)
        }
        else return yield next
      }

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
        if ('string' == typeof(item)) item = JSON.parse(item)
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

      // call next middleware and cache response on return
      yield next

      let _response = new Object()

      for (let key in this.response) {
        if (responseKeys.indexOf(key) != -1)
          _response[key] = this.response[key]
      }

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
