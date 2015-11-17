# koa-cache-lite

Zero-dependency koa router cache

## Example usage

```js
'use strict'

var cache = require('koa-cache-lite')
var koa = require('koa')()

// use in-memory cache
koa.use(cache({
  '/api/v1/test': 3000
}, {
  debug: true
}))

// or redis (install ioredis manually with npm install ioredis)
koa.use(cache({
  '/api/v1/test': 3000
}, {
  external: {
    type: 'redis',
    host: '127.0.0.1',
    port: 6379
  },
  debug: true
}))

// use increasing cache timeout and customize cache key
koa.use(cache({
    '/api/v1/test': 'increasing'
  }, {
    increasing: {
        // cache timeout per step
        timeout: [1000, 2000, 5000, 10000, 20000, 30000],
         // number of route calls per minute needed to increase cache timeout
        countHit: [1, 5, 25, 100, 500, 2500]
    },
    // header field containing cache key appendix
    keyFragment: 'cache',
    debug: true
}))

koa.listen(1337)
```

koa-cache-lite accepts two arguments.
First one is an object consisting of routes (route from this.request.path is a key and Boolean/Number/String is a value representing cache timeout for the specified route) and the second one is an options object, having an 'external' key where a type of cache and its location are defined, 'increasing' key where the cache timeout and count hit per step can be defined and 'keyFragment' where additional key fragments can be defined to customize the cache key. The debug mode can be flagged, also (console is used for debugging).
