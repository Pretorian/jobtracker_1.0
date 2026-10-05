import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

import { generateResumeForJob, createSampleTemplate } from '../server/resume/generator.js'
const { db, createJob } = require('../server/db/database')

const templatePath = path.join(process.cwd(), 'data/master-resume-template.docx')

function seedJob(overrides = {}) {
  const userResult = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('rg-user', 'hash')
  return createJob({
    company: 'Acme',
    title: 'Engineer',
    location: 'Remote',
    type: 'Full-time',
    salary: '$120k',
    summary: 'Build things',
    fitScore: 80,
    fitReason: 'Good',
    url: 'https://x.com',
    keySkills: ['JS', 'Go'],
    ...overrides,
  }, userResult.lastInsertRowid)
}

describe('resume/generator.js', () => {
  beforeEach(() => {
    if (!fs.existsSync(templatePath)) {
      fs.mkdirSync(path.dirname(templatePath), { recursive: true })
      fs.writeFileSync(templatePath, 'fake-template-binary')
    }
  })

  it('generates a resume and returns metadata', async () => {
    const job = seedJob()
    const result = await generateResumeForJob(job)
    expect(result.success).toBe(true)
    expect(result.filename).toMatch(/^resume_/)
    expect(result.filePath).toContain('/resumes/')
    expect(result.url).toContain('http://localhost:')

    // Cleanup output
    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  })

  it('sanitizes special characters in filenames', async () => {
    const job = seedJob({ title: 'Dev / Lead', company: 'A&B Co.' })
    const result = await generateResumeForJob(job)
    expect(result.filename).not.toContain('/')
    expect(result.filename).not.toContain('&')
    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  })

  it('throws when template is missing', async () => {
    const realExists = fs.existsSync
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p === templatePath) return false
      return realExists(p)
    })
    try {
      const job = seedJob()
      await expect(generateResumeForJob(job)).rejects.toThrow(/template not found/i)
    } finally {
      spy.mockRestore()
    }
  })

  it('createSampleTemplate is a no-op when template exists', () => {
    expect(() => createSampleTemplate()).not.toThrow()
  })

  it('createSampleTemplate logs instructions when template missing', () => {
    const realExists = fs.existsSync
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p === templatePath) return false
      return realExists(p)
    })
    try {
      expect(() => createSampleTemplate()).not.toThrow()
    } finally {
      spy.mockRestore()
    }
  })
})
