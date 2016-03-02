'use strict'

var Store = require('./lib/store')
var responseKeys = [ 'status', 'message', 'header', 'body' ]

class Cache {
  options(routes, options) {
    if (options.debug) console.info('cache options:', options)
    this.routes = routes
    this.options = options
  }

  middleware() {
    var that = this

    this.options.expireOpts = new Map()
    this.defaultTimeout = 5000
    this.store = new Store(this.options)

    for (let key of Object.keys(this.routes)) {
      // validate and reorganize route values
      if (typeof this.routes[key] !== 'object'
        && typeof this.routes[key] !== 'boolean'
        && this.routes[key] !== 'increasing'
        && isNaN(this.routes[key])) {

        if (this.options.debug) console.info('invalid value for key', key)

        delete this.routes[key]
        continue
      }

      if (!isNaN(this.routes[key]))
        this.routes[key] = {
          timeout: this.routes[key]
        }
      else if (this.routes[key] === 'increasing') {
        this.routes[key] = {
          timeout: 'increasing'
        }

        if (!this.callCnt) this.callCnt = new Map()
      }

      if (this.routes[key].cacheKeyArgs instanceof Array) {
        if (this.options.debug) console.info('cacheKeyArgs of array type not supported:', key)
        delete this.routes[key]
        continue
      }

      if (typeof this.routes[key].cacheKeyArgs === 'string') {
        this.routes[key].cacheKeyArgs = {
          custom: this.routes[key].cacheKeyArgs
        }
      }

      if (this.routes[key].cacheKeyArgs && typeof this.routes[key].cacheKeyArgs.headers === 'string') {
        this.routes[key].cacheKeyArgs.headers = [ this.routes[key].cacheKeyArgs.headers ]
      }

      if (this.routes[key].cacheKeyArgs && typeof this.routes[key].cacheKeyArgs.query === 'string') {
        this.routes[key].cacheKeyArgs.query = [ this.routes[key].cacheKeyArgs.query ]
      }

      // parse caching route params
      if (key.indexOf(':') !== -1) {
        this.routes[key]['regex'] = new RegExp(
          key.replace(/:[A-z0-9]+/g, '[A-z0-9]+')
          .replace(/^\//, '^\/')
          .replace(/$/, '(?:\/)?$')
          .replace(/\//g, '\\/'))

      }

      if (key.indexOf('*') !== -1) {
        this.routes[key]['regex'] = new RegExp(
          key.replace('*', '.*'))
      }
    }

    let routeKeys = Object.keys(this.routes)
    let routeKeysLength = routeKeys.length

    // set default increasing options if not defined
    if (this.callCnt) {
      if (this.options.increasing === undefined) {
        this.options.increasing = {
          1: 1000,
          3: 2000,
          10: 3000,
          20: 4000,
          50: 5000
        }
      }

      var cntStep = Object.keys(this.options.increasing)

      for (let key of cntStep) {
        if (typeof this.options.increasing[key] === 'string') {
          if (this.options.increasing[key].search(/[0-9]+s$/) !== -1)
            this.options.increasing[key] = Number(this.options.increasing[key].replace('s', '')) * 1000
          else if (this.options.increasing[key].search(/[0-9]+m$/) !== -1)
            this.options.increasing[key] = Number(this.options.increasing[key].replace('m', '')) * 60000
          else if (this.options.increasing[key].search(/[0-9]+h$/) !== -1)
            this.options.increasing[key] = Number(this.options.increasing[key].replace('h', '')) * 60000 * 60
          else if (this.options.increasing[key].search(/[0-9]+d$/) !== -1)
            this.options.increasing[key] = Number(this.options.increasing[key].replace('d', '')) * 60000 * 60 * 24
          else {
            if (this.options.debug) console.info('increasing timeout value invalid:', this.options.increasing[key])
            delete this.options.increasing[key]
          }
        }
      }

      // clear call hit counter every minute
      setInterval(() => {
        if (this.options.debug) console.info('clearing call hit counter')
        this.callCnt = new Map()
      }, 60000)
    }

    return function *(next) {
      try {
        // check if route is permitted to be cached FIXME?
        if (!routeKeysLength) return yield next;

        // create key
        let cacheKey, requestKey = this.request.path

        for (let i = 0; i < routeKeysLength; i++) {
          cacheKey = routeKeys[i]

          // first pass - exact match
          if (cacheKey === this.request.path) {
            if (that.options.debug)
              console.info('exact matched route:', this.request.path)

            if (that.routes[cacheKey].cacheKeyArgs)
              requestKey = yield setRequestKey(requestKey, cacheKey, this.request)

            let ok = yield setExpires(i, requestKey)
            if (!ok) return yield next

            break
          }
          else if (!that.routes[routeKeys[i]].regex) continue

          // second pass - regex match
          else if (that.routes[routeKeys[i]].regex.test(this.request.path)) {
            if (that.options.debug)
              console.info('regex matched route:', this.request.url, that.routes[routeKeys[i]].regex)

            if (that.routes[cacheKey].cacheKeyArgs)
              requestKey = yield setRequestKey(requestKey, cacheKey, this.request)

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
        if (this.request.method !== 'GET') {
          for (let i = 0; i < routeKeysLength; i++) {
            let key = routeKeys[i]

            if (requestKey.indexOf(key) != -1) {
              that.store.remove(requestKey)
            }
          }
          return yield next
        }

        // return cached response
        let requestKeyHeaders, requestKeyBody

        if ('undefined' !== typeof that.routes[cacheKey].cacheKeyPrefix) {
          requestKeyHeaders = that.routes[cacheKey].cacheKeyPrefix + ':' + requestKey + ':headers'
          requestKeyBody = that.routes[cacheKey].cacheKeyPrefix + ':' + requestKey + ':body'
        }
        else if ('undefined' !== typeof that.options.cacheKeyPrefix) {
          requestKeyHeaders = that.options.cacheKeyPrefix + ':' + requestKey + ':headers'
          requestKeyBody = that.options.cacheKeyPrefix + ':' + requestKey + ':body'
        }
        else {
          requestKeyHeaders = requestKey + ':headers'
          requestKeyBody = requestKey + ':body'
        }

        let exists = yield that.store.has(requestKeyHeaders)

        if (exists) {
          let body, headers = yield that.store.get(requestKeyHeaders)

          if ('string' === typeof(headers)) headers = JSON.parse(headers)
          if (that.options.debug) console.info('returning from cache for url', requestKey)

          for (let key in headers) {
            if (key === 'header') {
              let value = headers[key]

              for (let hkey in value) {
                this.set(hkey, value[hkey])
              }

              continue
            }

            this[key] = headers[key]
          }

          if (this.type === 'application/octet-stream' || this.type.indexOf('image/' !== -1))
            body = yield that.store.getBuffer(requestKeyBody)
          else
            body = yield that.store.get(requestKeyBody)

          if (body) this['body'] = body
          return
        }

        // call next middleware and cache response on return
        yield next

        let _response_body, _response_headers = new Object()

        for (let key in this.response) {
          if (key === 'body') continue

          if (responseKeys.indexOf(key) !== -1)
            _response_headers[key] = this.response[key]
        }

        if (this.response.body)
          _response_body = this.response.body

        if (that.options.debug) console.info('caching', requestKey)

        // set new caching entry
        let storeRequest = {}
        storeRequest[requestKeyHeaders] = JSON.stringify(_response_headers)
        storeRequest[requestKeyBody] = _response_body

        that.store.setMultiple(requestKey, storeRequest)
      }
      catch (error) {
        if (that.options.debug) console.error(error)
        this.throw(error)
      }
    }

    function *setExpires(routeKeysIndex, requestKey) {
      let routeExpire = that.routes[routeKeys[routeKeysIndex]].timeout

      if (routeExpire === false) {
        return false
      }

      // override default timeout
      if (typeof routeExpire === 'boolean') routeExpire = that.options.defaultTimeout
      else if (routeExpire === 'increasing' && that.options.increasing) {
        let count = that.callCnt.has(requestKey)

        if (count) {
          count = that.callCnt.get(requestKey) + 1
          that.callCnt.set(requestKey, count)
          let steps = cntStep.length

          for (let i = 0; i < steps; i++) {
            if (count === cntStep[i]) {
              that.options.expireOpts.set(requestKey, that.options.increasing[cntStep[i]])
              break
            }
          }
        }
        else {
          that.callCnt.set(requestKey, 1)
          that.options.expireOpts.set(requestKey, that.options.increasing[cntStep[0]])
        }
      }
      else that.options.expireOpts.set(requestKey, routeExpire)

      return true
    }

    function *setRequestKey(requestKey, routeKey, ctx) {
      // append specified http headers to requestKey
      if (that.routes[routeKey].cacheKeyArgs.headers instanceof Array) {
        requestKey += '#'

        for (let name of that.routes[routeKey].cacheKeyArgs.headers) {
          requestKey += ctx.header[name]
        }
      }

      // ...or append all http headers to requestKey
      else if (that.routes[routeKey].cacheKeyArgs.headers === true) {
        requestKey += '#'

        for (let name of Object.keys(ctx.headers)) {
          requestKey += ctx.headers[name]
        }
      }

      // append specified http url query parameters to requestKey
      if (that.routes[routeKey].cacheKeyArgs.query instanceof Array) {
        requestKey += '?'

        for (let name of Object.keys(ctx.query)) {
          requestKey += ctx.query[name]
        }
      }

      // ...or append all http url query parameters to requestKey
      else if (that.routes[routeKey].cacheKeyArgs.query === true)
        requestKey += '?' + ctx.querystring

      return requestKey
    }
  }
}

module.exports = new Cache()
