[![GitHub license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/mkozjak/koa-cache-lite/blob/master/LICENSE)  
[![NPM](https://nodei.co/npm/koa-cache-lite.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/koa-cache-lite/)

# koa-cache-lite

Zero-dependency koa router cache

## News

**important** Breaking API changes were made since version 3.x

Once included, the library now returns the 'options' and 'middleware' methods.

'options' is used to configure caching, and 'middleware' to get the generator which can be used with koa.use()

See below for API details and examples.

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
cache.options({
  '/api/v1/test': 3000
}, {
  debug: true
})

// or redis (install ioredis manually with npm install ioredis)
cache.options({
  '/api/v1/test': 3000
}, {
  external: {
    type: 'redis',
    host: '127.0.0.1',
    port: 6379
  },
  debug: true
})

// use increasing cache timeout and customize cache key
cache.options({
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
})

// start caching
koa.use(cache.middleware())

koa.listen(1337)
```

## API

koa-cache-lite accepts two arguments.  

First one is an object consisting of routes and the second one is an options object, having an 'external' key where a type of cache and its location are defined,  
'increasing' key consisting of cache timeouts per step  
(Number representing route calls per minute needed to increase cache timeout is the key and Number is a value representing cache timeout per step)  
and 'cacheKeyArgs' where additional internal labeling values can be defined to customize the cache key.  
The debug mode can be enabled (console is used for debugging).

### cache.options(routes[, options]) -> Class

Sets various caching options regarding urls, internal cache keys, debug mode and more.

routes {Object}:

* `key`: `{String}` A string value consisting of optional parameter placeholders used to match the route for caching.
For example, one can have multiple colon placeholders throughout the url to flag the dynamic parts of it and one asterisk to match everything with and after the given string.

```js
cache.options({
  ...
  routes: {
    {String}: {String|Number|Boolean}
  }
})

// or
cache.options({
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
cache.options({
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

options {Object}:

* `type`: `{String}` Type of caching system used. Can be 'memory' or 'redis' (in which case you need to install ioredis manually).
* `host`: `{String}` If `type` is 'redis', the address used to connect to.
* `port`: `{Number}` If `type` is 'redis', the port used to connect to.
* `increasing`: `{Object}` An object consisting of api calls per minute cache timeout increase.
* `cacheKeyArgs`: `{String}` Default cache key to be used internally by the library.
* `cacheKeyPrefix`: `{String}` Cache key prefix for storing.
* `debug`: `{Boolean}` Flag showing whether to debug the middleware or not.

### cache.init() -> Class

Start the caching process. This method should only be used when different contexts throughout your application are used.
In example, when using the 'cluster' module, you should use `cache.init()` in master and send a wrapped `cache.clear()` function
to worker processes so you can use the Cache instance.

```js
cache.init()
```

### cache.middleware() -> Generator

Start the caching process and returns a generator which can be used in conjunction with koa.use().

```js
koa.use(cache.middleware())
```

### cache.clear([keys])

Clear cache entries individually or all of them. If 'keys' is not provided it clears all the keys based on cacheKeyPrefix if defined.

```js
// clear all keys (based on cacheKeyPrefix)
cache.clear()

// or only /api/v1/users
cache.clear('/api/v1/users')
```

### cache.currentCacheType -> String

Returns a type of caching system currently used.
