import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

import authRouter from '../server/routes/auth.js'
const { makeApp } = require('./helpers/express')
const bcrypt = require('bcrypt')
const { db } = require('../server/db/database')

function seedUser(username = 'tester', password = 'password123') {
  const hash = bcrypt.hashSync(password, 4)
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash)
}

describe('routes/auth.js', () => {
  describe('POST /login', () => {
    const app = makeApp(authRouter, { session: {} })

    beforeEach(() => {
      seedUser('alice', 'secret123')
    })

    it('returns 400 when missing fields', async () => {
      const res = await request(app).post('/login').send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Validation failed')
    })

    it('returns 401 for unknown user', async () => {
      const res = await request(app).post('/login').send({ username: 'nobody', password: 'x' })
      expect(res.status).toBe(401)
    })

    it('returns 401 for wrong password', async () => {
      const res = await request(app).post('/login').send({ username: 'alice', password: 'wrong' })
      expect(res.status).toBe(401)
    })

    it('returns 200 + user on success', async () => {
      const res = await request(app).post('/login').send({ username: 'alice', password: 'secret123' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.user.username).toBe('alice')
    })

    it('returns 500 when login throws', async () => {
      // Force getUserByUsername to throw via spies
      const dbModule = require('../server/db/database')
      const orig = dbModule.getUserByUsername
      dbModule.getUserByUsername = () => { throw new Error('oops') }
      // re-require auth router would be needed if it copied the fn, but auth.js
      // destructures at module load. Restore approach: monkeypatch via the
      // module-level table connection — drop the users table to force a query error.
      dbModule.getUserByUsername = orig
      db.exec('DROP TABLE users')
      const res = await request(app).post('/login').send({ username: 'alice', password: 'secret123' })
      expect(res.status).toBe(500)
      // Recreate to keep other tests happy (other tests will reset via __resetDb)
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)
    })
  })

  describe('POST /logout', () => {
    const app = makeApp(authRouter, { session: { userId: 1, username: 'alice' } })

    it('clears session and returns 200', async () => {
      const res = await request(app).post('/logout')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns 500 if destroy fails', async () => {
      const app2 = require('express')()
      app2.use(require('express').json())
      app2.use((req, res, next) => {
        req.session = { destroy: (cb) => cb(new Error('boom')) }
        next()
      })
      app2.use(authRouter)
      const res = await request(app2).post('/logout')
      expect(res.status).toBe(500)
    })
  })

  describe('GET /me', () => {
    it('returns user when authenticated', async () => {
      const app = makeApp(authRouter, { session: { userId: 7, username: 'bob' } })
      const res = await request(app).get('/me')
      expect(res.status).toBe(200)
      expect(res.body.user.username).toBe('bob')
    })

    it('returns 401 when not authenticated', async () => {
      const app = makeApp(authRouter, { session: {} })
      const res = await request(app).get('/me')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /change-password', () => {
    beforeEach(() => {
      seedUser('alice', 'oldpw')
    })

    it('returns 400 for short new password', async () => {
      const app = makeApp(authRouter, { session: { userId: 1, username: 'alice' } })
      const res = await request(app).post('/change-password').send({
        currentPassword: 'oldpw',
        newPassword: 'short',
        confirmPassword: 'short',
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when passwords do not match', async () => {
      const app = makeApp(authRouter, { session: { userId: 1, username: 'alice' } })
      const res = await request(app).post('/change-password').send({
        currentPassword: 'oldpw',
        newPassword: 'newpassw',
        confirmPassword: 'different',
      })
      expect(res.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
      const app = makeApp(authRouter, { session: {} })
      const res = await request(app).post('/change-password').send({
        currentPassword: 'oldpw',
        newPassword: 'newpassw',
        confirmPassword: 'newpassw',
      })
      expect(res.status).toBe(401)
    })

    it('returns 401 when current password is wrong', async () => {
      const app = makeApp(authRouter, { session: { userId: 1, username: 'alice' } })
      const res = await request(app).post('/change-password').send({
        currentPassword: 'wrong',
        newPassword: 'newpassw',
        confirmPassword: 'newpassw',
      })
      expect(res.status).toBe(401)
    })

    it('updates password on success', async () => {
      const app = makeApp(authRouter, { session: { userId: 1, username: 'alice' } })
      const res = await request(app).post('/change-password').send({
        currentPassword: 'oldpw',
        newPassword: 'newpassw',
        confirmPassword: 'newpassw',
      })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })
})
