[![GitHub license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/mkozjak/koa-cache-lite/blob/master/LICENSE)  
[![NPM](https://nodei.co/npm/koa-cache-lite.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/koa-cache-lite/)

# koa-cache-lite

Zero-dependency koa router cache

## Installation

Locally in your project or globally:

```
npm install koa-cache-lite
npm install -g koa-cache-lite
```

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

## API

```js
cache(routes, options)
```

koa-cache-lite accepts two arguments.  

First one is an object consisting of routes and the second one is an options object, having an 'external' key where a type of cache and its location are defined,  
'increasing' key consisting of cache timeouts per step  
(Number representing route calls per minute needed to increase cache timeout is the key and Number is a value representing cache timeout per step)  
and 'cacheKeyArgs' where additional internal labeling values can be defined to customize the cache key.  
The debug mode can be enabled (console is used for debugging).

Routes {Object}:

* `key`: `{String}` A string value consisting of optional parameter placeholders used to match the route for caching.
For example, one can have multiple colon placeholders throughout the url to flag the dynamic parts or it and one asterisk to match everything with and after the given string.

```js
cache({
  ...
  routes: {
    {String}: {String|Number|Boolean}
  }
})

// or
cache({
  ...
  routes: {
    {String}: {
      timeout: {String|Number}
      cacheKeyArgs: {
        headers: {String|Array},
        query: {String|Array}
      }
    }
  }
})

// in example
cache({
  ...
  routes: {

    // will cache based on parameter 'id'
    '/api/client/:id/tickets': 30000,

    // will cache based on parameter 'uid' and an http header field 'x-auth-custom'
    '/api/admin/register/:uid': {
      timeout: 10000,
      cacheKeyArgs: {
        headers: 'x-auth-custom'
      }
    }
  }
})
```

Options {Object}:

* `type`: `{String}` Type of caching system used. Can be 'memory' or 'redis' (in which case you need to install ioredis manually).
* `host`: `{String}` If `type` is 'redis', the address used to connect to.
* `port`: `{Number}` If `type` is 'redis', the port used to connect to.
* `increasing`: `{Object}` An object consisting of api calls per minute cache timeout increase.
* `cacheKeyArgs`: `{String}` Default cache key to be used internally by the library.
* `debug`: `{Boolean}` Flag showing whether to debug the middleware or not.

