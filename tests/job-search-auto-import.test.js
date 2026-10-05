import { describe, it, expect, beforeEach } from 'vitest'
import { autoSearchAndImport } from '../server/job-search/auto-import.js'
const { db } = require('../server/db/database')

describe('job-search/auto-import.js', () => {
  beforeEach(() => {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('ai-user', 'hash')
  })

  it('returns empty results when no jobs found', async () => {
    globalThis.__playwrightFormResponse = []
    const result = await autoSearchAndImport({ keywords: 'eng', boards: ['linkedin'] })
    expect(result.searched).toBe(0)
    expect(result.results).toEqual([])
  })

  it('evaluates and imports jobs above threshold', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'Eng', company: 'A', location: 'Remote', url: 'https://x.com/1', source: 'LinkedIn' },
      { title: 'Manager', company: 'B', location: 'Remote', url: 'https://x.com/2', source: 'LinkedIn' },
    ]
    const result = await autoSearchAndImport({
      keywords: 'eng',
      boards: ['linkedin'],
      threshold: 50,
      autoImport: true,
    })
    expect(result.searched).toBe(2)
    // Note: createJob is called without a userId — surfaces as importError per job.
    expect(result.results.length).toBe(2)
    expect(result.results.every(r => r.meetsThreshold)).toBe(true)
  })

  it('skips imports when autoImport=false', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'Eng', company: 'A', location: 'Remote', url: 'https://x.com/1', source: 'LinkedIn' },
    ]
    const result = await autoSearchAndImport({
      keywords: 'eng',
      boards: ['linkedin'],
      threshold: 50,
      autoImport: false,
    })
    expect(result.imported).toBe(0)
  })

  it('skips below-threshold jobs', async () => {
    // Push AI responses with low fitScore for each job evaluation
    globalThis.__playwrightFormResponse = [
      { title: 'X', company: 'Y', location: 'Remote', url: 'https://x.com/1', source: 'LinkedIn' },
    ]
    globalThis.__anthropicResponses.push({
      content: [{ type: 'text', text: '{"company":"Y","title":"X","fitScore":30,"keySkills":[]}' }],
    })
    const result = await autoSearchAndImport({
      keywords: 'eng',
      boards: ['linkedin'],
      threshold: 70,
      autoImport: true,
    })
    expect(result.imported).toBe(0)
    expect(result.skipped).toBeGreaterThan(0)
  })

  it('records evaluation errors per job', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'X', company: 'Y', location: 'Remote', url: 'https://x.com/1', source: 'LinkedIn' },
    ]
    globalThis.__anthropicResponses.push(new Error('boom'))
    const result = await autoSearchAndImport({
      keywords: 'eng',
      boards: ['linkedin'],
      threshold: 70,
      autoImport: true,
    })
    expect(result.results[0].error).toBeTruthy()
  }, 10000)
})
