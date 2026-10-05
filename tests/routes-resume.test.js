import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'

import resumeRouter from '../server/routes/resume.js'
const { makeApp } = require('./helpers/express')
const { db, createJob } = require('../server/db/database')

const app = makeApp(resumeRouter, { session: { userId: 1, username: 'tester' } })
const templatePath = path.join(process.cwd(), 'data/master-resume-template.docx')

describe('routes/resume.js', () => {
  beforeEach(() => {
    if (!fs.existsSync(templatePath)) fs.writeFileSync(templatePath, 'fake')
  })

  describe('GET /template', () => {
    it('returns template metadata when present', async () => {
      const res = await request(app).get('/template')
      expect(res.status).toBe(200)
      expect(res.body.exists).toBe(true)
    })

    it('returns exists=false when template missing', async () => {
      fs.rmSync(templatePath, { force: true })
      const res = await request(app).get('/template')
      expect(res.status).toBe(200)
      expect(res.body.exists).toBe(false)
    })
  })

  describe('GET /template/download', () => {
    it('downloads the template', async () => {
      const res = await request(app).get('/template/download')
      expect(res.status).toBe(200)
    })

    it('returns 404 when missing', async () => {
      fs.rmSync(templatePath, { force: true })
      const res = await request(app).get('/template/download')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /template/upload', () => {
    it('rejects non-docx files', async () => {
      const tmpFile = path.join(process.cwd(), 'data', 'tmp', `bad-${Date.now()}.txt`)
      fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
      fs.writeFileSync(tmpFile, 'plain text')
      const res = await request(app)
        .post('/template/upload')
        .attach('template', tmpFile)
      expect(res.status).toBe(500)
      fs.rmSync(tmpFile, { force: true })
    })

    it('returns 400 when no file uploaded', async () => {
      const res = await request(app).post('/template/upload')
      expect(res.status).toBe(400)
    })

    it('uploads a valid docx', async () => {
      const tmpFile = path.join(process.cwd(), 'data', 'tmp', `good-${Date.now()}.docx`)
      fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
      fs.writeFileSync(tmpFile, 'fake-docx-binary-content')
      const res = await request(app)
        .post('/template/upload')
        .attach('template', tmpFile, {
          filename: 'good.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('DELETE /template', () => {
    it('deletes the template with backup', async () => {
      const res = await request(app).delete('/template')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns 404 when template missing', async () => {
      fs.rmSync(templatePath, { force: true })
      const res = await request(app).delete('/template')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /suggest-roles', () => {
    it('returns 404 when template missing', async () => {
      fs.rmSync(templatePath, { force: true })
      const res = await request(app).post('/suggest-roles')
      expect(res.status).toBe(404)
    })

    it('returns AI suggestions when template present', async () => {
      const res = await request(app).post('/suggest-roles')
      expect(res.status).toBe(200)
      expect(res.body.profileSummary).toBeTruthy()
    })

    it('returns 500 when AI response is not JSON', async () => {
      globalThis.__anthropicResponses.push({
        content: [{ type: 'text', text: 'not json' }],
      })
      const res = await request(app).post('/suggest-roles')
      expect(res.status).toBe(500)
    })
  })

  afterAll(() => {
    // Clean up backup files from delete tests
    const dataDir = path.join(process.cwd(), 'data')
    if (fs.existsSync(dataDir)) {
      for (const f of fs.readdirSync(dataDir)) {
        if (f.includes('.backup.') || f.includes('.deleted.')) {
          fs.rmSync(path.join(dataDir, f), { force: true })
        }
      }
    }
  })
})
