'use strict'

/*
based on hyper{core,drive}-archiver
but oriented specifically around dat

todo
- readme
- test suite + travis + coveralls
- publish to npm
 */

const async = require('async')
const Dat = require('dat-node')
const datResolve = require('dat-link-resolve')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const mkdirp = require('mkdirp')
const os = require('os')
const path = require('path')
const pkg = require('./package.json')
const rimraf = require('rimraf')
const _ = require('lodash')
const debug = require('debug')(pkg.name)

const DIR = path.join(os.homedir(), `.${pkg.name}`)
const DAT_OPTIONS = {
  live: true
}

function _toKey (buf) {
  return buf.toString('hex')
}

module.exports = class Archiver {
  constructor (dir = DIR, options = {}) {
    debug('constructor', dir, options)
    this.dir = path.resolve(dir).replace('~', os.homedir())
    this.emitter = new EventEmitter()
    this.dats = {}
    this.datOptions = _.extend(DAT_OPTIONS, options.dat)
    this.netOptions = options.net || {}
  }

  start (done) {
    debug('start')
    mkdirp.sync(this.dir)
    async.parallel([
      (done) => {
        async.waterfall([
          fs.readdir.bind(fs, this.dir),
          (dirNames, done) => {
            async.filter(dirNames, (dirName, done) => {
              datResolve(dirName, (err, key) => {
                if (err) return done()
                done(null, key)
              })
            }, done)
          },
          (datKeys, done) => {
            async.each(datKeys, (key, done) => {
              async.waterfall([
                Dat.bind(Dat, path.join(this.dir, key), _.extend(this.datOptions, { key })),
                (dat, done) => {
                  this.dats[key] = dat
                  dat.joinNetwork(this.netOptions)
                  dat.network.on('listening', () => {
                    done()
                  })
                }
              ], done)
            }, done)
          }
        ], done)
      },
      (done) => {
        async.waterfall([
          Dat.bind(Dat, this.dir, this.datOptions),
          (dat, done) => {
            this.dat = dat
            dat.joinNetwork(this.netOptions)
            done()
          }
        ], done)
      }
    ], done)
  }

  stop (done) {
    const close = (dat, done) => {
      async.parallel([
        dat.close.bind(dat),
        dat.leave.bind(dat)
      ], done)
    }
    debug('stop')
    const keys = Object.keys(this.dats)
    var tasks = [(done) => {
      debug('stopping root dat')
      close(this.dat, done)
    }]
    if (keys.length) {
      tasks.push((done) => {
        async.each(keys, (key, done) => {
          debug(`stopping ${key}`)
          close(this.dats[key], done)
        }, done)
      })
    }
    async.parallel(tasks, done)
  }

  get (link, done) {
    debug(`get ${link}`)
    async.waterfall([
      datResolve.bind(null, link),
      (buf, done) => {
        let key = _toKey(buf)
        if (key in this.dats) {
          done(null, this.dats[key])
        } else {
          let dir = path.join(this.dir, key)
          Dat(dir, { key }, done)
        }
      }
    ], done)
  }

  add (link, done) {
    debug(`add ${link}`)
    async.waterfall([
      datResolve.bind(null, link),
      (buf, done) => {
        let key = _toKey(buf)
        if (key in this.dats) {
          done(new Error(`Dat archive is already being peered: ${key}.`))
        } else {
          let dir = path.join(this.dir, key)
          let opts = _.extend(this.datOptions, { key })
          async.series([
            mkdirp.bind(mkdirp, dir),
            Dat.bind(Dat, dir, opts)
          ], (err, result) => {
            if (err) return done(err)
            done(null, result[1])
          })
        }
      },
      (dat, done) => {
        let key = dat.key.toString('hex')
        this.dats[key] = dat
        this.emitter.emit('add', key)
        dat.joinNetwork(this.netOptions)
        done()
      }
    ], done)
  }

  remove (link, done) {
    debug(`remove ${link}`)
    async.waterfall([
      datResolve.bind(null, link),
      (buf, done) => {
        let key = _toKey(buf)
        let dat = this.dats[key]
        if (dat) {
          delete this.dats[key]
          async.series([
            dat.close.bind(dat),
            rimraf.bind(rimraf, path.join(this.dir, key))
          ], (err) => {
            if (err) return done(err)
            this.emitter.emit('remove', key)
            done()
          })
        } else {
          done()
        }
      }
    ], done)
  }

  list (done) {
    debug(`list`)
    async.waterfall([
      fs.readdir.bind(fs, this.dir),
      (dirNames, done) => {
        async.filter(dirNames, (dirName, done) => {
          datResolve(dirName, (err, key) => {
            if (err) return done()
            done(null, key)
          })
        }, done)
      }
    ], done)
  }

  get key () {
    return this.dat.key
  }

  static create (dir, options) {
    return new Archiver(dir, options)
  }

  static get DEFAULT_DIR () {
    return DIR
  }
}
