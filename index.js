'use strict'

const Store = require('./lib/store')
const responseKeys = [ 'status', 'message', 'header', 'body' ]
const querystring = require('querystring')
const StringDecoder = require('string_decoder').StringDecoder
const zlib = require('zlib')

class Cache {
  configure(routes, options) {
    if (options.debug) {
      if (options.logging && options.logging instanceof Function) {
        options._debug = options.logging
      }
      else {
        const util = require('util')

        options._debug = function() {
          process.stdout.write((new Date).toISOString() + ' '
            + util.format.apply(null, arguments) + '\n')
        }
      }

      options._debug('cache options:', options)
    }

    this.routes = routes
    this.options = options

    return this
  }

  init() {
    if (!this.routes)
      this.routes = { '*': 'increasing' }

    if (!this.options)
      this.options = {}

    this.options.expireOpts = new Map()
    this.options.defaultTimeout = 5000
    this.store = new Store(this.options)

    for (let key of Object.keys(this.routes)) {
      // validate and reorganize route values
      if (typeof this.routes[key] !== 'object'
          && typeof this.routes[key] !== 'boolean'
          && this.routes[key] !== 'increasing'
          && isNaN(this.routes[key])) {

        if (this.options.debug) this.options._debug('invalid value for key', key)

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

        if (!this.callCount) this.callCount = new Map()
      }

      if (this.routes[key].cacheKeyArgs instanceof Array) {
        if (this.options.debug) this.options._debug('cacheKeyArgs of array type not supported:', key)
        delete this.routes[key]
        continue
      }

      if (this.routes[key].cacheKeyArgs) {
        if (typeof this.routes[key].cacheKeyArgs === 'string') {
          this.routes[key].cacheKeyArgs = {
            custom: this.routes[key].cacheKeyArgs
          }
        }
        else {
          if (typeof this.routes[key].cacheKeyArgs.headers === 'string')
            this.routes[key].cacheKeyArgs.headers = [ this.routes[key].cacheKeyArgs.headers ]
          else if (this.routes[key].cacheKeyArgs.headers instanceof Array)
            this.routes[key].cacheKeyArgs.headers = this.routes[key].cacheKeyArgs.headers.sort()

          if (typeof this.routes[key].cacheKeyArgs.query === 'string')
            this.routes[key].cacheKeyArgs.query = [ this.routes[key].cacheKeyArgs.query ]
          else if (this.routes[key].cacheKeyArgs.query instanceof Array)
            this.routes[key].cacheKeyArgs.query = this.routes[key].cacheKeyArgs.query.sort()
        }
      }

      // parse caching route params
      if (key.indexOf(':') !== -1) {
        this.routes[key]['regex'] = new RegExp(
          key.replace(/:[A-z0-9]+/g, '[A-z0-9\\$\\-_.+!*\'(),]+')
          .replace(/^\//, '^\/')
          .replace(/$/, '(?:\/)?$')
          .replace(/\//g, '\\/'))
      }

      if (key.indexOf('*') !== -1) {
        this.routes[key]['regex'] = new RegExp(
          key.replace('*', '.*'))
      }
    }

    this.routeKeys = Object.keys(this.routes)
    this.routeKeysLength = this.routeKeys.length

    // set default increasing options if not defined
    if (this.callCount) {
      if (this.options.increasing === undefined) {
        this.options.increasing = {
          1: 5000,
          3: 15000,
          10: 30000,
          20: 60000,
          50: 120000
        }
      }

      this.cntStep = Object.keys(this.options.increasing)

      for (let key of this.cntStep) {
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
            if (this.options.debug) this.options._debug('increasing timeout value invalid:', this.options.increasing[key])
            delete this.options.increasing[key]
          }
        }
      }

      // clear call hit counter every minute
      setInterval(() => {
        if (this.options.debug) this.options._debug('clearing call hit counter')
        this.callCount = new Map()
      }, 60000)
    }

    return this
  }

  middleware() {
    var that = this

    if (!this.store) this.init()

    return function *(next) {
      try {
        // check if route is permitted to be cached FIXME?
        if (!that.routeKeysLength) return yield next;

        // create key
        let cacheKey, requestKey = this.request.path

        for (let i = 0; i < that.routeKeysLength; i++) {
          cacheKey = that.routeKeys[i]

          // first pass - exact match
          if (cacheKey === this.request.path) {
            if (that.options.debug)
              that.options._debug('exact matched route:', this.request.path)

            if (that.routes[cacheKey].cacheKeyArgs)
              requestKey = yield setRequestKey(requestKey, cacheKey, this.request)

            if (!requestKey) return yield next

            let ok = yield setExpires(i, requestKey)
            if (!ok) return yield next

            break
          }
          else if (!that.routes[that.routeKeys[i]].regex) continue

          // second pass - regex match
          else if (that.routes[that.routeKeys[i]].regex.test(this.request.path)) {
            if (that.options.debug)
              that.options._debug('regex matched route:', this.request.url, that.routes[that.routeKeys[i]].regex)

            if (that.routes[cacheKey].cacheKeyArgs)
              requestKey = yield setRequestKey(requestKey, cacheKey, this.request)

            if (!requestKey) return yield next

            let ok = yield setExpires(i, requestKey)
            if (!ok) return yield next

            break
          }

          if (i === that.routeKeys.length - 1) return yield next
          else continue
        }

        // check if no-cache is provided (if not overridden)
        if (that.options.ignoreNoCache !== true && this.request.header['cache-control'] === 'no-cache') {
          return yield next
        }

        // check if HTTP methods other than GET are sent and invalidate cache if true
        if (this.request.method !== 'GET') {
          for (let i = 0; i < that.routeKeysLength; i++) {
            let key = that.routeKeys[i]

            if (requestKey.indexOf(key) != -1) {
              that.store.remove(requestKey)
            }
          }
          return yield next
        }

        // return cached response
        let requestKeyHeaders, requestKeyBody

        if (that.options.vary)
          for (let o of that.options.vary)
            this.response.vary(o)
        else
            this.response.vary('Accept-Encoding')

        let mod = '%'

        for (let o of this.response.headers.vary.split(','))
          mod += this.request.get(o.trim().toLowerCase())

        if ('undefined' !== typeof that.routes[cacheKey].cacheKeyPrefix) {
          requestKeyHeaders = that.routes[cacheKey].cacheKeyPrefix + ':' + requestKey + ':headers' + mod
          requestKeyBody = that.routes[cacheKey].cacheKeyPrefix + ':' + requestKey + ':body' + mod
        }
        else if ('undefined' !== typeof that.options.cacheKeyPrefix) {
          requestKeyHeaders = that.options.cacheKeyPrefix + ':' + requestKey + ':headers' + mod
          requestKeyBody = that.options.cacheKeyPrefix + ':' + requestKey + ':body' + mod
        }
        else {
          requestKeyHeaders = requestKey + ':headers' + mod
          requestKeyBody = requestKey + ':body' + mod
        }

        let exists = yield that.store.has(requestKeyHeaders)

        if (exists) {
          let body, headers = yield that.store.get(requestKeyHeaders)

          if ('string' === typeof(headers)) headers = JSON.parse(headers)
          if (that.options.debug) that.options._debug('returning from cache for url', requestKey)

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

          if (this.type === 'application/octet-stream' ||
              this.type.indexOf('image/') !== -1 ||
              this.request.acceptsEncodings([ 'gzip', 'deflate' ]))
            body = yield that.store.getBuffer(requestKeyBody)
          else if (this.type === 'text/html' || this.type === 'text/plain') {
            body = yield that.store.get(requestKeyBody)
            body = JSON.parse(body)
          }
          else
            body = yield that.store.get(requestKeyBody)

          if (body) this['body'] = body
          return
        }

        // call next middleware and cache response on return
        yield next

        if (that.options.minimumSize > this.length)
          return yield next

        let _response_body, _response_headers = new Object()

        for (let key in this.response) {
          if (key === 'body') {
            if (this.response.body instanceof zlib.Gzip) {
              _response_body = yield (() => {
                return new Promise((resolve, reject) => {
                  let body = Buffer.from('')
                  const decoder = new StringDecoder('utf8')

                  this.response.body.on('data', (chunk) => body = Buffer.concat([ body, chunk ]))

                  this.response.body.once('end', () => {
                    this.response.body = body
                    resolve(body)
                  })

                  this.response.body.once('error', (error) => reject(error))
                })
              })()

              continue
            }

            _response_body = this.response.body
            continue
          }

          if (responseKeys.indexOf(key) !== -1)
            _response_headers[key] = this.response[key]
        }

        if (that.options.debug) that.options._debug('caching', requestKey)

        // set new caching entry
        let storeRequest = {}
        storeRequest[requestKeyHeaders] = JSON.stringify(_response_headers)
        storeRequest[requestKeyBody] = JSON.stringify(_response_body)

        that.store.setMultiple(requestKey, storeRequest)
      }
      catch (error) {
        if (that.options.debug) console.error(error)
        this.throw(error)
      }
    }

    function *setExpires(routeKeysIndex, requestKey) {
      let routeExpire = that.routes[that.routeKeys[routeKeysIndex]].timeout

      if (routeExpire === false) {
        return false
      }

      // override default timeout
      if (typeof routeExpire === 'boolean') routeExpire = that.options.defaultTimeout
      else if (routeExpire === 'increasing' && that.options.increasing) {
        let count = that.callCount.has(requestKey)

        if (count) {
          count = that.callCount.get(requestKey) + 1
          that.callCount.set(requestKey, count)
          let steps = that.cntStep.length

          for (let i = 0; i < steps; i++) {
            if (count === that.cntStep[i]) {
              that.options.expireOpts.set(requestKey, that.options.increasing[that.cntStep[i]])
              break
            }
          }
        }
        else {
          that.callCount.set(requestKey, 1)
          that.options.expireOpts.set(requestKey, that.options.increasing[that.cntStep[0]])
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
        // if the query combination doesn't match, don't cache
        let queryParams = Object.keys(ctx.query)

        if (that.routes[routeKey].cacheKeyArgs.query.length !== queryParams.length)
          return false

        queryParams = queryParams.sort()

        for (let i in queryParams) {
          if (queryParams[i] !== that.routes[routeKey].cacheKeyArgs.query[i])
            return false
        }

        requestKey += '?' + querystring.stringify(ctx.query)
      }

      // ...or append all http url query parameters to requestKey
      else if (that.routes[routeKey].cacheKeyArgs.query === true) {
        requestKey += '?' + ctx.querystring
      }

      return requestKey
    }
  }

  exists(key) {
    return this.store.has(key)
  }

  clear(keys) {
    if (!keys) {
      if (this.options.cacheKeyPrefix)
        this.store.remove(this.options.cacheKeyPrefix + ':*')
      else
        this.store.remove()

      return
    }

    if (this.options.cacheKeyPrefix)
      this.store.remove([
        this.options.cacheKeyPrefix + ':' + keys,
        this.options.cacheKeyPrefix + ':' + keys + ':*',
        this.options.cacheKeyPrefix + ':' + keys + '\\?*',
        this.options.cacheKeyPrefix + ':' + keys + '#*' ])
    else
      this.store.remove([ keys, keys + ':*', keys + '\\?*', keys + '#*' ])
  }

  currentCacheType() {
    return this.store.storeType()
  }
}

module.exports = new Cache()
