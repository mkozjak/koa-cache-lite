'use strict'

var Store = require('./lib/store')
var responseKeys = [ 'header', 'body' ]

module.exports = function(routes, opts) {
  if (opts.debug) console.info('cache options:', routes, opts)

  opts.expireOpts = new Map()
  opts.callCnt = new Map()
  opts.defaultTimeout = 5000
  var store = new Store(opts)

  let routeKeys = Object.keys(routes)
  let routeKeysLength = routeKeys.length

  // set default increasing options if not defined
  let incrs
  if (opts.increasing !== undefined) incrs = opts.increasing
  else
    incrs = {
      1: 1000,
      3: 2000,
      10: 3000,
      20: 4000,
      50: 5000
    }

  let cntStep = Object.keys(incrs)

  // clear call hit counter every minute
  setInterval(function() {
    if (opts.debug) console.info('clearing call hit counter')
    opts.callCnt = new Map()
  }, 60000)

  return function *(next) {
    try {
      // check if route is permitted to be cached
      if (!routeKeysLength) return yield next;

      // create key
      let request_url = this.request.url
      if(opts.keyFragment !== undefined) {
        if(this.request.header[opts.keyFragment] !== undefined) {
          request_url = request_url.concat("@", this.request.header[opts.keyFragment])
        }
        else {
            if (opts.debug) console.warn('Key fragment "%s" not set!', opts.keyFragment)
            return yield next
        }
      }

      for (let i = 0; i < routeKeysLength; i++) {
        let key = routeKeys[i]
        if (request_url.indexOf(key) != -1) {
          let routeExpire = routes[key]

          if (routeExpire == false) {
            return yield next
          }

          if (isNaN(routeExpire) && (typeof routeExpire !== 'boolean') && (routeExpire !== 'increasing')) {
            if (opts.debug) console.warn('invalid cache setting:', routeExpire)
            return yield next
          }

          // override default timeout
          if (typeof routeExpire === 'boolean') routeExpire = opts.defaultTimeout
          else if (routeExpire === 'increasing') {
              let count = opts.callCnt.has(request_url)
              if (count) {
                count = opts.callCnt.get(request_url) + 1
                opts.callCnt.set(request_url, count)
                let steps = cntStep.length
                for(let i = 0; i < steps; i++) {
                  if (count == cntStep[i]) {
                    opts.expireOpts.set(request_url, incrs[cntStep[i]])
                    break
                  }
                }
              }
              else {
                opts.callCnt.set(request_url, 1)
                opts.expireOpts.set(request_url, incrs[cntStep[0]])
              }
          }
          else opts.expireOpts.set(request_url, routeExpire)
          break
        }

        if (i == routeKeys.length - 1) return yield next
        else continue
      }

      // check if no-cache is provided
      if (this.request.header['cache-control'] == 'no-cache') {
        return yield next
      }

      // check if HTTP methods other than GET are sent and invalidate cache if true
      if (this.request.method != 'GET') {
        for (let i = 0; i < routeKeysLength; i++) {
          let key = routeKeys[i]
          if (request_url.indexOf(key) != -1) {
            store.delete(request_url)
          }
        }
        return yield next
      }

      // return cached response
      let exists = yield store.has(request_url)

      if (exists) {
        let item = yield store.get(request_url)
        if ('string' == typeof(item)) item = JSON.parse(item)
        if (opts.debug) console.info('returning from cache for url', request_url)

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

      if (opts.debug) console.info('caching', request_url)

      // set new caching entry
      store.set(request_url, _response)
    }
    catch (error) {
      if (opts.debug) console.error(error)
      this.throw(error)
    }
  }
}
