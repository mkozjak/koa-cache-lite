'use strict'

try {
  var events = require('events')
  var Redis = require('ioredis')
  var util = require('util')
}
catch(error) {
  throw new Error('Please install ioredis manually (optional dependency)')
}

function Driver() {
  events.EventEmitter.call(this)
  if (false === (this instanceof Driver)) return new Driver()
}

util.inherits(Driver, events.EventEmitter)

Driver.prototype.connect = function(_opts) {
  this.opts = _opts
  this.conn = new Redis({
    port: this.opts.port || 6379,
    host: this.opts.host || '127.0.0.1',
    password: this.opts.password || null,
    autoResendUnfulfilledCommands: false,
    retryStrategy: (times) => {
      if (this.opts.debug) console.info('connection with redis failed', times, 'times')

      if (times == 1 && !this.conn._lock) this.conn._lock = true

      if (times == 5) {
        this.emit('fail')
        return false
      }

      return 1*1000
    }
  })

  this.conn.on('error', (error) => {
    if (this.opts.debug) console.info('redis error:', error, error.stack)
    this.emit('fail')
  })

  this.conn.on('ready', () => {
    if (this.opts.debug) console.info('using Redis for caching')
    if (this.conn._lock) this.conn._lock = false
  })

  this.conn.on('authError', (error) => {
    if (this.opts.debug) console.info('redis authError:', error)
    this.emit('fail')
  })
}

Driver.prototype.get = function(key) {
  return this.conn.get(key)
}

Driver.prototype.getBuffer = function(key) {
  return this.conn.getBuffer(key)
}

Driver.prototype.has = function(key) {
  return this.conn.exists(key).then((check) => {
    if (check > 0) return Promise.resolve(true)
    else return Promise.resolve(false)
  })
}

Driver.prototype.set = function(key, value, timeout) {
  if (this.opts.debug) console.info('setting new item in cache for url', key)

  return this.conn.set(key, JSON.stringify(value)).then(() => {
    return this.conn.expire(key, ((opts) => {
      if (opts.expireOpts.has(key)) return opts.expireOpts.get(key) / 1000
      return opts.defaultTimeout / 1000
    })(this.opts))
  })
}

Driver.prototype.setMultiple = function(requestKey, params, timeout) {
  if (this.opts.debug) console.info('setting new item in cache for params', params)

  return this.conn.mset(params).then(() => {
    for (let key of Object.keys(params)) {
      this.conn.expire(key, ((opts) => {
        if (opts.expireOpts.has(requestKey)) return opts.expireOpts.get(requestKey) / 1000
        return opts.defaultTimeout / 1000
      })(this.opts))
    }
  })
}

Driver.prototype.delete = function(key) {
  if (this.conn.exists(key)) return this.conn.del(key)
}

module.exports = Driver
