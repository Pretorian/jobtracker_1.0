import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

import { generateCoverLetter } from '../server/cover-letter/generator.js'
const { db, createJob } = require('../server/db/database')

const templatePath = path.join(process.cwd(), 'data/cover-letter-template.docx')
const resumeTemplatePath = path.join(process.cwd(), 'data/master-resume-template.docx')

function seedJob(overrides = {}) {
  const userResult = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('cl-user', 'hash')
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

describe('cover-letter/generator.js', () => {
  it('generates a cover letter using the template when present', async () => {
    if (!fs.existsSync(templatePath)) {
      fs.writeFileSync(templatePath, 'fake-cover-template')
    }

    const job = seedJob()
    const result = await generateCoverLetter(job)
    expect(result.success).toBe(true)
    expect(result.filename).toMatch(/^cover_letter_/)
    expect(result.hasTemplate).toBe(true)

    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  })

  it('falls back to plain text when template is missing', async () => {
    if (fs.existsSync(templatePath)) fs.unlinkSync(templatePath)
    const job = seedJob({ location: null })
    // Null out company/title locally to exercise the fallback strings, while keeping
    // DB NOT NULL constraints happy.
    job.company = null
    job.title = null
    const result = await generateCoverLetter(job)
    expect(result.success).toBe(true)
    expect(result.filename).toMatch(/\.txt$/)
    expect(result.hasTemplate).toBe(false)

    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    expect(fs.existsSync(outputPath)).toBe(true)
    fs.unlinkSync(outputPath)
  })

  it('throws when AI response is not valid JSON', async () => {
    globalThis.__anthropicResponses.push({
      content: [{ type: 'text', text: 'not json' }],
    })
    const job = seedJob()
    await expect(generateCoverLetter(job)).rejects.toThrow(/Failed to parse cover letter content/)
  })

  it('uses fallback summary fields when description/roleSummary missing', async () => {
    const job = seedJob({ summary: null })
    job.description = undefined
    job.roleSummary = undefined
    job.keySkills = null
    const result = await generateCoverLetter(job)
    expect(result.success).toBe(true)

    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  })
})
