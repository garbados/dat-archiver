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

const DIR = path.join(os.homedir(), `.${pkg.name}`)

module.exports = class Archiver {
  constructor (dir = DIR, options = {}) {
    this.dir = path.resolve(dir).replace('~', os.homedir())
    this.emitter = new EventEmitter()
  }

  start (done) {
    mkdirp.sync(this.dir)
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
        async.map(datKeys, (key, done) => {
          async.waterfall([
            Dat.bind(Dat, path.join(this.dir, key), { key }),
            (dat, done) => {
              this.dats[key] = dat
              dat.joinNetwork()
              dat.archive.metadata.update(done)
            }
          ], done)
        }, done)
      }
    ], done)
  }

  stop (done) {
    async.each(Object.keys(this.dats), (key, done) => {
      let dat = this.dats[key]
      dat.close(done)
    }, done)
  }

  on (event, callback) {
    return this.emitter.on(event, callback)
  }

  get (link, done) {
    async.waterfall([
      datResolve.bind(null, link),
      (key, done) => {
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
    async.waterfall([
      datResolve.bind(null, link),
      (key, done) => {
        if (key in this.dats) {
          done(new Error(`Dat archive is already being peered: ${key}.`))
        } else {
          let dir = path.join(this.dir, key)
          Dat(dir, { key }, done)
        }
      },
      (dat, done) => {
        this.dats[dat.key] = dat
        dat.joinNetwork()
        dat.archive.metadata.update(() => {
          this.emitter.emit('add', dat.key)
          done()
        })
      }
    ], done)
  }

  remove (link, done) {
    async.waterfall([
      datResolve.bind(null, link),
      (key, done) => {
        let dat = this.dats[key]
        this.emit('remove', key)
        delete this.dats[key]
        async.parallel([
          dat.close.bind(dat),
          rimraf.bind(null, path.join(this.dir, key))
        ], (err) => {
          if (err) return done(err)
          this.emitter.emit('remove', key)
          done()
        })
      }
    ], done)
  }

  list (done) {
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
    ])
  }

  static create (dir, options) {
    return new Archiver(dir, options)
  }

  static get DEFAULT_DIR () {
    return DIR
  }
}
