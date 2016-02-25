'use strict'

var Store = require('./lib/store')
var responseKeys = [ 'status', 'message', 'header', 'body' ]

module.exports = (routes, opts) => {
  // if (opts.debug) console.info('cache options:', routes, opts)

  opts.expireOpts = new Map()
  opts.callCnt = new Map()
  opts.defaultTimeout = 5000
  var store = new Store(opts)

  for (let key of Object.keys(routes)) {
    // validate and reorganize route values
    if (typeof routes[key] !== 'object'
      && typeof routes[key] !== 'boolean'
      && routes[key] !== 'increasing'
      && isNaN(routes[key])) {

      if (opts.debug) console.info('invalid value for key', key)

      delete routes[key]
      continue
    }

    if (!isNaN(routes[key]))
      routes[key] = {
        timeout: routes[key]
      }
    else if (routes[key] === 'increasing')
      routes[key] = {
        timeout: 'increasing'
      }

    if (routes[key].cacheKeyArgs instanceof Array) {
      if (opts.debug) console.info('cacheKeyArgs of array type not supported:', key)
      delete routes[key]
      continue
    }

    if (typeof routes[key].cacheKeyArgs === 'string') {
      routes[key].cacheKeyArgs = {
        custom: routes[key].cacheKeyArgs
      }
    }

    if (routes[key].cacheKeyArgs && typeof routes[key].cacheKeyArgs.headers === 'string') {
      routes[key].cacheKeyArgs.headers = [ routes[key].cacheKeyArgs.headers ]
    }

    if (routes[key].cacheKeyArgs && typeof routes[key].cacheKeyArgs.query === 'string') {
      routes[key].cacheKeyArgs.query = [ routes[key].cacheKeyArgs.query ]
    }

    // parse caching route params
    if (key.indexOf(':') !== -1) {
      routes[key]['regex'] = new RegExp(
        key.replace(/:[A-z0-9]+/g, '[A-z0-9]+')
        .replace(/^\//, '^\/')
        .replace(/$/, '(?:\/)?$')
        .replace(/\//g, '\\/'))

    }
  }

  let routeKeys = Object.keys(routes)
  let routeKeysLength = routeKeys.length

  // set default increasing options if not defined
  if (opts.increasing === undefined)
    opts.increasing = {
      1: 1000,
      3: 2000,
      10: 3000,
      20: 4000,
      50: 5000
  }

  let cntStep = Object.keys(opts.increasing)

  // clear call hit counter every minute
  setInterval(() => {
    if (opts.debug) console.info('clearing call hit counter')
    opts.callCnt = new Map()
  }, 60000)

  return function *(next) {
    try {
      // check if route is permitted to be cached
      if (!routeKeysLength) return yield next;

      // create key
      let requestKey = this.request.url

      // first pass - exact match
      for (let i = 0; i < routeKeysLength; i++) {
        let key = routeKeys[i]

        if (key === this.request.url) {
          if (opts.debug)
            console.info('matched route:', this.request.url, routes[routeKeys[i]].regex)

          if (routes[key].cacheKeyArgs)
            requestKey = yield setRequestKey(requestKey, key, this.request)

          let ok = yield setExpires(i, requestKey)
          if (!ok) return yield next

          break
        }
      }

      // second pass - regex match
      for (let i = 0; i < routeKeysLength; i++) {
        let key = routeKeys[i]

        if (!routes[routeKeys[i]].regex) continue

        if (routes[routeKeys[i]].regex.test(this.request.url)) {
          if (opts.debug)
            console.info('matched route:', this.request.url, routes[routeKeys[i]].regex)

          if (routes[key].cacheKeyArgs)
            requestKey = yield setRequestKey(requestKey, key, this.request)

          let ok = yield setExpires(i, requestKey)
          if (!ok) return yield next

          break
        }

        if (i === routeKeys.length - 1) return yield next
        else continue
      }

      // check if no-cache is provided
      if (this.request.header['cache-control'] === 'no-cache') {
        return yield next
      }

      // check if HTTP methods other than GET are sent and invalidate cache if true
      if (this.request.method != 'GET') {
        for (let i = 0; i < routeKeysLength; i++) {
          let key = routeKeys[i]

          if (requestKey.indexOf(key) != -1) {
            store.delete(requestKey)
          }
        }
        return yield next
      }

      // return cached response
      let exists = yield store.has(requestKey)

      if (exists) {
        let item = yield store.get(requestKey)

        if ('string' === typeof(item)) item = JSON.parse(item)
        if (opts.debug) console.info('returning from cache for url', requestKey)

        for (let key in item) {
          if (key === 'header') {
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

      if (opts.debug) console.info('caching', requestKey)

      // set new caching entry
      store.set(requestKey, _response)
    }
    catch (error) {
      if (opts.debug) console.error(error)
      this.throw(error)
    }
  }

  function *setExpires(routeKeysIndex, requestKey) {
    let routeExpire = routes[routeKeys[routeKeysIndex]].timeout

    if (routeExpire === false) {
      return false
    }

    // override default timeout
    if (typeof routeExpire === 'boolean') routeExpire = opts.defaultTimeout
    else if (routeExpire === 'increasing') {
      let count = opts.callCnt.has(requestKey)

      if (count) {
        count = opts.callCnt.get(requestKey) + 1
        opts.callCnt.set(requestKey, count)
        let steps = cntStep.length

        for (let i = 0; i < steps; i++) {
          if (count === cntStep[i]) {
            opts.expireOpts.set(requestKey, opts.increasing[cntStep[i]])
            break
          }
        }
      }
      else {
        opts.callCnt.set(requestKey, 1)
        opts.expireOpts.set(requestKey, opts.increasing[cntStep[0]])
      }
    }
    else opts.expireOpts.set(requestKey, routeExpire)

    return true
  }

  function *setRequestKey(requestKey, routeKey, ctx) {
    // append specified http headers to requestKey
    if (routes[routeKey].cacheKeyArgs.headers instanceof Array) {
      requestKey += '#'

      for (let name of routes[routeKey].cacheKeyArgs.headers) {
        requestKey += ctx.header[name]
      }
    }

    // ...or append all http headers to requestKey
    else if (routes[routeKey].cacheKeyArgs.headers === true) {
      requestKey += '#'

      for (let name of Object.keys(ctx.headers)) {
        requestKey += ctx.headers[name]
      }
    }

    // append specified http url query parameters to requestKey
    if (routes[routeKey].cacheKeyArgs.query instanceof Array) {
      requestKey += '?'

      for (let name of Object.keys(ctx.query)) {
        requestKey += ctx.query[name]
      }
    }

    // ...or append all http url query parameters to requestKey
    else if (routes[routeKey].cacheKeyArgs.query === true)
      requestKey += '?' + ctx.querystring

    return requestKey
  }
}
