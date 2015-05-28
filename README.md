# koa-cache-lite

Zero-dependency koa router cache

## Example usage

```js
'use strict'

var cache = require('koa-cache-lite')
var koa = require('koa')()

koa.use(cache({
  '/api/v1/test': 3000
}, false))

koa.listen(1337)
```

koa-cache-lite accepts two arguments.
First one is an object consisting of routes (route from this.request.path is a key and Boolean/Number is a value) and the second one is a Boolean value, flagging the debug mode (console is used for debugging).
