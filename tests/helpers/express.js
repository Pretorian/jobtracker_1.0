const express = require('express')

function makeApp(router, { mountPath = '/', session = { userId: 1, username: 'tester' } } = {}) {
  const app = express()
  app.use(express.json())
  // Stubbed session middleware — assigns a fixed session before routes run.
  app.use((req, res, next) => {
    req.session = {
      ...session,
      destroy: (cb) => cb && cb(null),
    }
    next()
  })
  app.use(mountPath, router)
  return app
}

module.exports = { makeApp }
