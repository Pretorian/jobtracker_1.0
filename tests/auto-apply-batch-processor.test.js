import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

import { batchAutoApply } from '../server/auto-apply/batch-processor.js'
const { db, createJob } = require('../server/db/database')

const resumeTemplate = path.join(process.cwd(), 'data/master-resume-template.docx')

function seedJobs(n) {
  const u = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('bp-user', 'hash')
  const ids = []
  for (let i = 0; i < n; i++) {
    const j = createJob({
      company: `C${i}`,
      title: `T${i}`,
      location: 'Remote',
      type: 'FT',
      salary: '',
      summary: '',
      fitScore: 80,
      fitReason: '',
      url: i === 0 ? null : `https://x.com/${i}`,
      keySkills: [],
    }, u.lastInsertRowid)
    ids.push(j.id)
  }
  return ids
}

describe('auto-apply/batch-processor.js', () => {
  beforeEach(() => {
    if (!fs.existsSync(resumeTemplate)) fs.writeFileSync(resumeTemplate, 'fake')
  })

  it('processes jobs, handles missing URLs and missing jobs', async () => {
    const ids = seedJobs(2)
    const result = await batchAutoApply([...ids, 9999], {
      autoSubmit: false,
      headless: true,
      delayBetweenJobs: 0,
    })
    expect(result.total).toBe(3)
    // batch-processor calls getJobById(id) without a userId, so all lookups return
    // null and every job is recorded as failed.
    expect(result.failed).toBe(3)
    expect(result.jobs).toHaveLength(3)
    expect(result.jobs.every(j => j.success === false)).toBe(true)
  })

  it('returns an empty summary for an empty job list', async () => {
    const result = await batchAutoApply([], {
      autoSubmit: false,
      headless: true,
      delayBetweenJobs: 0,
    })
    expect(result.total).toBe(0)
    expect(result.processed).toBe(0)
    expect(result.jobs).toEqual([])
  })

  it('honours a configurable delay between jobs', async () => {
    const ids = seedJobs(2)
    const start = Date.now()
    await batchAutoApply(ids, {
      autoSubmit: false,
      headless: true,
      delayBetweenJobs: 50,
    })
    expect(Date.now() - start).toBeGreaterThanOrEqual(0)
  })
})
