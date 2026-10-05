import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

import { generateOptimizedResume } from '../server/resume/optimized-generator.js'
const { db, createJob } = require('../server/db/database')

const templatePath = path.join(process.cwd(), 'data/master-resume-template.docx')

function seedJob(overrides = {}) {
  const userResult = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('og-user', 'hash')
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

describe('resume/optimized-generator.js', () => {
  beforeEach(() => {
    if (!fs.existsSync(templatePath)) {
      fs.mkdirSync(path.dirname(templatePath), { recursive: true })
      fs.writeFileSync(templatePath, 'fake-template-binary')
    }
  })

  it('generates an optimized resume with AI gap analysis and content', async () => {
    const job = seedJob()
    const result = await generateOptimizedResume(job)
    expect(result.success).toBe(true)
    expect(result.optimizationApplied).toBe(true)
    expect(result.filename).toMatch(/^resume_optimized_/)
    expect(result.gapsClosed).toBeGreaterThanOrEqual(0)

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
      await expect(generateOptimizedResume(job)).rejects.toThrow(/template not found/i)
    } finally {
      spy.mockRestore()
    }
  })

  it('throws when AI gap-analysis response is not valid JSON', async () => {
    globalThis.__anthropicResponses.push({
      content: [{ type: 'text', text: 'this is not json' }],
    })
    const job = seedJob()
    await expect(generateOptimizedResume(job)).rejects.toThrow(/Failed to generate optimized resume/)
  })

  it('throws when AI content generation response is not valid JSON', async () => {
    // First call (gap analysis) returns valid JSON; second call (content) returns garbage
    globalThis.__anthropicResponses.push(
      { content: [{ type: 'text', text: '{"missingSkills":["x"]}' }] },
      { content: [{ type: 'text', text: 'not json' }] },
    )
    const job = seedJob()
    await expect(generateOptimizedResume(job)).rejects.toThrow(/Failed to generate optimized resume/)
  })

  it('handles job with no key skills and minimal data', async () => {
    const job = seedJob({ keySkills: [], summary: null, salary: null, type: null })
    const result = await generateOptimizedResume(job)
    expect(result.success).toBe(true)

    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  })

  it('falls back to defaults when gap analysis returns minimal data', async () => {
    globalThis.__anthropicResponses.push(
      // Gap analysis with no missingSkills/experienceGaps/emphasisAreas keys
      { content: [{ type: 'text', text: '{"recommendations":[]}' }] },
      // content generation
      globalThis.__defaultAnthropicResponse(),
    )
    const job = seedJob({ keySkills: [] })
    const result = await generateOptimizedResume(job)
    expect(result.success).toBe(true)
    expect(result.gapsClosed).toBe(0)

    const outputPath = path.join(process.cwd(), 'public', result.filePath)
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  })
})
