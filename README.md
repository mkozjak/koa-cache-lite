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
      1: 1000,  // key = route calls per minute, value = cache timeout
      5: 2000,
      25: 5000,
      100: 10000
    },
    keyFragment: 'cache', // header field containing cache key appendix
    debug: true
}))

koa.listen(1337)
```

koa-cache-lite accepts two arguments.  
First one is an object consisting of routes (route from this.request.path is a key and Boolean/Number/String is a value representing cache timeout for the specified route)  
and the second one is an options object, having an 'external' key where a type of cache and its location are defined,  
'increasing' key consisting of cache timeouts per step  
(Number representing route calls per minute needed to increase cache timeout is the key and Number is a value representing cache timeout per step)  
and 'keyFragment' where additional key fragments can be defined to customize the cache key.  
The debug mode can be flagged, also (console is used for debugging).
