#!/usr/bin/env node
'use strict'

const Archiver = require('.')
const pkg = require('./package.json')

require('yargs')
  .version(pkg.version)
  .command({
    command: '$0',
    aliases: ['start'],
    desc: 'TODO',
    handler: (argv) => {
      Archiver.create(argv.dir).start(() => {
        // TODO examine, debug
        console.log(arguments)
      })
    }
  })
  .command({
    command: 'add <link>',
    aliases: ['a'],
    desc: 'TODO',
    handler: (argv) => {
      Archiver.create(argv.dir).add(argv.link, (err) => {
        if (err) throw err
        console.log(`Successfully added Dat archive associated with ${argv.link}`)
      })
    }
  })
  .command({
    command: 'remove <link>',
    aliases: ['rm'],
    desc: 'TODO',
    handler: (argv) => {
      Archiver.create(argv.dir).remove(argv.link, (err) => {
        if (err) throw err
        console.log(`Successfully removed Dat archive associated with ${argv.link}`)
      })
    }
  })
  .command({
    command: 'list',
    desc: 'TODO',
    aliases: ['l', 'ls'],
    handler: (argv) => {
      Archiver.create(argv.dir).list((err, keys) => {
        if (err) throw err
        console.log('Found these keys:')
        keys.forEach((key) => {
          console.log(key)
        })
      })
    }
  })
  .option('dir', {
    alias: 'd',
    desc: 'TODO',
    default: Archiver.DEFAULT_DIR
  })
  .alias('help', 'h')
  .parse()
