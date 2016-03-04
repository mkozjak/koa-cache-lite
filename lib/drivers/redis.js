'use strict'

try {
  var events = require('events')
  var Redis = require('ioredis')
  var util = require('util')
}
catch(error) {
  throw new Error('Please install ioredis manually (optional dependency)')
}

module.exports = class extends events.EventEmitter {
  constructor() {
    super()
  }

  connect(options) {
    this.options = options
    this.connection = new Redis({
      port: this.options.port || 6379,
      host: this.options.host || '127.0.0.1',
      password: this.options.password || null,
      autoResendUnfulfilledCommands: false,
      retryStrategy: (times) => {
        if (this.options.debug) console.info('connection with redis failed', times, 'times')

        if (times == 1 && !this.connection._lock) this.connection._lock = true

        if (times == 5) {
          this.emit('fail')
          return false
        }

        return 1*1000
      }
    })

    this.connection.on('error', (error) => {
      if (this.options.debug) console.info('redis error:', error, error.stack)
      this.emit('fail')
    })

    this.connection.on('ready', () => {
      if (this.options.debug) console.info('using Redis for caching')
      if (this.connection._lock) this.connection._lock = false
    })

    this.connection.on('authError', (error) => {
      if (this.options.debug) console.info('redis authError:', error)
      this.emit('fail')
    })
  }

  get(key) {
    return this.connection.get(key)
  }

  getBuffer(key) {
    return this.connection.getBuffer(key)
  }

  has(key) {
    return this.connection.exists(key).then((check) => {
      if (check > 0) return Promise.resolve(true)
      else return Promise.resolve(false)
    })
  }

  set(key, value, timeout) {
    if (this.options.debug) console.info('setting new item in cache for url', key)

    return this.connection.set(key, JSON.stringify(value)).then(() => {
      return this.connection.expire(key, ((opts) => {
        if (opts.expireOpts.has(key)) return opts.expireOpts.get(key) / 1000
        return opts.defaultTimeout / 1000
      })(this.options))
    })
  }

  setMultiple(requestKey, params, timeout) {
    if (this.options.debug) console.info('setting new item in cache for params', params)

    return this.connection.mset(params).then(() => {
      for (let key of Object.keys(params)) {
        this.connection.expire(key, ((opts) => {
          if (opts.expireOpts.has(requestKey)) return opts.expireOpts.get(requestKey) / 1000
          return opts.defaultTimeout / 1000
        })(this.options))
      }
    })
  }

  remove(keys) {
    if (this.options.debug) console.info('deleting from redis cache', keys)

    if (!keys) {
      this.connection.flushdb
      return
    }
    else if ('string' === typeof keys) {
      this.connection.keys(keys).then((results) => {
        if (results.length > 0) this.connection.del(results)
      })

      return
    }

    let deleteKeys = []

    if (keys instanceof Array) {
      for (let key of keys) {
        if (key.indexOf('*') === -1) {
          deleteKeys.push(key)
          continue
        }

        this.connection.keys(key).then((results) => {
          for (let hit of results) {
            deleteKeys.push(hit)
          }
        })
      }
    }

    return this.connection.del(deleteKeys)
  }
}
