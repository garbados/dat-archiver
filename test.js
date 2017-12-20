const async = require('async')
const tap = require('tap')
const Archiver = require('.')
const pkg = require('./package.json')

const TEST_KEY = 'dat://95a964430e5a5c5203dde674a1873e51f2e8e78995855c1481020f405ee9a772/'

// mock the filesystem
tap.test([pkg.name, pkg.version].join(' '), (t) => {
  t.test({
    bail: true
  }, (test) => {
    const archiver = Archiver.create('./test-fixtures')

    async.series([
      archiver.start.bind(archiver),
      archiver.add.bind(archiver, TEST_KEY),
      (done) => {
        archiver.list((err, dirNames) => {
          test.error(err)
          test.equal(dirNames.length, 1)
          test.ok(TEST_KEY.indexOf(dirNames[0]) > -1)
          done()
        })
      },
      (done) => {
        archiver.get(TEST_KEY, (err, dat) => {
          test.error(err)
          test.ok(TEST_KEY.indexOf(dat.key.toString('hex')) > -1)
          done()
        })
      },
      archiver.remove.bind(archiver, TEST_KEY),
      archiver.stop.bind(archiver)
    ], (err) => {
      test.error(err)
      test.end()
    })
  })

  t.end()
})
