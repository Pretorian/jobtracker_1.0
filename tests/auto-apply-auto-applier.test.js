import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

import { autoApplyToJob, getDefaultUserData } from '../server/auto-apply/auto-applier.js'
const { db, createJob } = require('../server/db/database')

const resumeTemplate = path.join(process.cwd(), 'data/master-resume-template.docx')

function seedJob(overrides = {}) {
  const u = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('aa-user', 'hash')
  return createJob({
    company: 'Acme',
    title: 'Engineer',
    location: 'Remote',
    type: 'Full-time',
    salary: '$120k',
    summary: 'Build things',
    fitScore: 80,
    fitReason: 'Good',
    url: 'https://x.com/apply',
    keySkills: ['JS'],
    ...overrides,
  }, u.lastInsertRowid)
}

describe('auto-apply/auto-applier.js', () => {
  beforeEach(() => {
    if (!fs.existsSync(resumeTemplate)) {
      fs.writeFileSync(resumeTemplate, 'fake-template')
    }
  })

  it('runs dry run and stops before form fill', async () => {
    const job = seedJob()
    const result = await autoApplyToJob(job, { firstName: 'J', email: 'j@x.com' }, { dryRun: true })
    expect(result.success).toBe(true)
    expect(result.steps.formFilled).toBe(false)
    expect(result.steps.resumeGenerated).toBe(true)
    expect(result.steps.coverLetterGenerated).toBe(true)

    // Cleanup
    for (const f of [result.files.resume, result.files.coverLetter]) {
      if (!f) continue
      const p = path.join(process.cwd(), 'public', f)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('runs full flow when not dry run', async () => {
    const job = seedJob()
    const result = await autoApplyToJob(job, { firstName: 'J', email: 'j@x.com' }, {
      dryRun: false,
      headless: true,
      autoSubmit: false,
    })
    expect(result.success).toBe(true)
    expect(result.steps.formFilled).toBe(true)

    for (const f of [result.files.resume, result.files.coverLetter]) {
      if (!f) continue
      const p = path.join(process.cwd(), 'public', f)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('returns failure when job has no URL', async () => {
    const job = seedJob({ url: null })
    const result = await autoApplyToJob(job, {}, { dryRun: false, headless: true })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Job URL/)
  })

  it('getDefaultUserData reads env vars with safe defaults', () => {
    const oldEmail = process.env.USER_EMAIL
    process.env.USER_EMAIL = 'test@example.com'
    const data = getDefaultUserData()
    expect(data.email).toBe('test@example.com')
    expect(data.country).toBe('United States')
    expect(data.workAuthorization).toBe('Yes')
    process.env.USER_EMAIL = oldEmail
  })
})
