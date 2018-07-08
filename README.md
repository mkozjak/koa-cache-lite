[![GitHub license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/mkozjak/koa-cache-lite/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/dm/koa-cache-lite.svg?maxAge=2592000)](https://www.npmjs.com/package/koa-cache-lite)
[![Donate Bitcoin/Altcoins](https://img.shields.io/badge/donate-coins-blue.svg)](https://mario.kozjak.io/donate)  
[![NPM](https://nodei.co/npm/koa-cache-lite.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/koa-cache-lite/)

# koa-cache-lite

Zero-dependency koa router cache

## News

**important** Breaking API changes were made since version 3.x.

Once included, the library returns the 'configure', 'init', 'middleware', 'exists', 'clear' and 'currentCacheType' methods.

'configure' is used to configure caching, and 'middleware' to get the generator which can be used with koa.use().

'init' is an optional method for the initialization of the caching process.
This is a convenience method used, for example, in a 'cluster' environment,
where you would send a wrapped 'middleware' function to be able to, in example, clear cache from the worker,
even though the cache was initialized in the master process.

'clear' can be used to clear the cache and 'currentCacheType' to get the currently used caching system.

See below for API details and examples.

## Installation

Locally in your project or globally:

```
npm install koa-cache-lite
npm install -g koa-cache-lite
```

## Quick start

```js
'use strict'

var cache = require('koa-cache-lite')
var koa = require('koa')()

// use in-memory cache
cache.configure({
  '/api/v1/test': 3000
}, {
  debug: true
})

// or redis (install ioredis manually with npm install ioredis)
cache.configure({
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
cache.configure({
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

### cache.configure(routes[, options]) -> Class

Sets various caching options regarding urls, internal cache keys, debug mode and more.

routes {Object}:

* `key`: `{String}` A string value consisting of optional parameter placeholders used to match the route for caching.
For example, one can have multiple colon placeholders throughout the url to flag the dynamic parts of it and one asterisk to match everything with and after the given string.

```js
cache.configure({
  ...
  routes: {
    {String}: {String|Number|Boolean}
  }
})

// or
cache.configure({
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
cache.configure({
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

* `external`: `{Object}` External storage database configuration.
  * `type`: `{String}` Type of caching system used. Can be 'memory' or 'redis' (in which case you need to install ioredis manually).
  * `host`: `{String}` If `type` is 'redis', the address used to connect to. Defaults to '127.0.0.1'.
  * `port`: `{Number}` If `type` is 'redis', the port used to connect to. Defaults to 6379.
* `increasing`: `{Object}` An object consisting of api calls per minute cache timeout increase.
* `cacheKeyArgs`: `{String}` Default cache key to be used internally by the library.
* `cacheKeyPrefix`: `{String}` Cache key prefix for storing.
* `minimumSize`: `{Number}` Minimum http body size needed to cache the response.
* `vary`: `{Array}` List of HTTP request headers used for Vary. Defaults to '["Accept-Encoding"]'.
* `ignoreNoCache`: `{Boolean}` Flag for ignoring 'Cache-Control: no-cache' headers.
* `debug`: `{Boolean}` Flag showing whether to debug the middleware or not.
* `logging`: `{Function}` External logging function to be used for debugging.

### cache.init() -> Class

Start the caching process. This method should only be used when different contexts throughout your application are used.
In example, when using the 'cluster' module, you should use `cache.init()` in master and send a wrapped `cache.clear()` function
to worker processes so you can use the Cache instance.

```js
cache.init()
```

### cache.middleware() -> Generator

Starts the caching process and returns a generator which can be used in conjunction with koa.use().

```js
koa.use(cache.middleware())
```

### cache.exists(key) -> Promise

Check if cache for the given key exists.

### cache.clear([keys])

Clear cache entries individually or all of them. If 'keys' is not provided it clears all the keys based on cacheKeyPrefix if defined.
It also supports glob-style patterns:
* h?llo matches hello, hallo and hxllo
* h*llo matches hllo and heeeello
* h[ae]llo matches hello and hallo, but not hillo
* h[^e]llo matches hallo, hbllo, ... but not hello
* h[a-b]llo matches hallo and hbllo

```js
// clear all keys (based on cacheKeyPrefix)
cache.clear()

// or only /api/v1/users
cache.clear('/api/v1/users')

// or anything under '/api/v2'
cache.clear('/api/v2/*')
```

### cache.currentCacheType() -> String

Returns a type of caching system currently used.

## Professional support
I offer professional support for koa-cache-lite and beyond. I have many years of expertise on building robust, scalable Node.js applications and can help you overcome issues and challenges preventing you to ship your great products. I also excel in software architecture and implementation, being able to provide you with development, planning, consulting, training and customization services. Feel free to [contact me](mailto:kozjakm1@gmail.com?subject=Support) so we can discuss how to help you finish your products!

## Sponsors
Become a sponsor and get your logo on project's README on GitHub with a link to your site. Feel free to [contact me](mailto:kozjakm1@gmail.com?subject=Sponsors) for the arrangement!

## Donate

If you love this project, consider [donating](https://mario.kozjak.io/donate)!

## License

  [MIT](LICENSE)
