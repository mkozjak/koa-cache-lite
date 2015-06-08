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

// or redis
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


koa.listen(1337)
```

koa-cache-lite accepts two arguments.
First one is an object consisting of routes (route from this.request.path is a key and Boolean/Number is a value) and the second one is an options object, having an 'external' key where a type of cache and its location are defined. The debug mode can be flagged, also (console is used for debugging).
