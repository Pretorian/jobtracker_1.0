import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

import { AutoApplyAgent } from '../server/auto-apply/intelligent-agent.js'
const { db, createJob } = require('../server/db/database')

const resumeTemplate = path.join(process.cwd(), 'data/master-resume-template.docx')

function seedJob(overrides = {}) {
  const u = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('ia-user', 'hash')
  return createJob({
    company: 'Acme',
    title: 'Engineer',
    location: 'Remote',
    type: 'FT',
    salary: '',
    summary: '',
    fitScore: 80,
    fitReason: '',
    url: 'https://example.com/apply',
    keySkills: ['JS'],
    ...overrides,
  }, u.lastInsertRowid)
}

function defaultUserData() {
  return { firstName: 'J', lastName: 'S', fullName: 'J S', email: 'j@x.com', phone: '555-1' }
}

describe('auto-apply/intelligent-agent.js', () => {
  beforeEach(() => {
    if (!fs.existsSync(resumeTemplate)) fs.writeFileSync(resumeTemplate, 'fake')
    globalThis.__puppeteerFieldsResponse = null
  })

  it('executes a full test-mode run end to end', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), {
      testMode: true,
      recordVideo: false,
      dryRun: false,
    })
    const report = await agent.execute()
    expect(report.success).toBe(true)
    expect(report.mode).toBe('test')
    expect(report.testMode).toBeTruthy()
    expect(report.metadata.tokensUsed).toBeGreaterThan(0)
    expect(report.metadata.apiCalls).toBeGreaterThan(0)

    // attempt and session were persisted
    const attempt = db.prepare('SELECT * FROM application_attempts WHERE id = ?').get(report.attemptId)
    expect(attempt.status).toBe('completed')
    const session = db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(report.sessionId)
    expect(session.status).toBe('completed')
  })

  it('executes in dry-run mode and skips application execution', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), {
      testMode: false,
      dryRun: true,
      recordVideo: false,
    })
    const report = await agent.execute()
    expect(report.success).toBe(true)
    expect(report.mode).toBe('live')
    expect(report.execution).toBeUndefined()
  })

  it('executes in live mode', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), {
      testMode: false,
      dryRun: false,
      headless: true,
      autoSubmit: false,
      recordVideo: false,
    })
    const report = await agent.execute()
    expect(report.success).toBe(true)
    expect(report.mode).toBe('live')
    expect(report.execution).toBeTruthy()

    // Clean up generated files
    for (const f of [report.documents.resume, report.documents.coverLetter]) {
      if (!f) continue
      const p = path.join(process.cwd(), 'public', f)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('falls back to default platform analysis on AI error', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), {
      testMode: true,
      recordVideo: false,
    })
    // AI call order during testMode execute():
    //   1. cover letter generation
    //   2. analyzeApplicationPlatform
    //   3. generateApplicationStrategy
    //   4. analyzeFieldsWithAI
    globalThis.__anthropicResponses.push(
      globalThis.__defaultAnthropicResponse(),
      new Error('platform analysis boom'),
    )
    const report = await agent.execute()
    expect(report.platform.platform).toBe('unknown')
    expect(report.platform.confidence).toBe('low')
  })

  it('throws when document generation fails (no template)', async () => {
    fs.rmSync(resumeTemplate, { force: true })
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), {
      testMode: true,
      recordVideo: false,
    })
    await expect(agent.execute()).rejects.toThrow()

    // Should have updated the attempt as failed
    const attempt = db.prepare(`
      SELECT * FROM application_attempts WHERE agentSessionId = ?
    `).get(agent.sessionId)
    expect(attempt.status).toBe('failed')
  })

  it('getStatus reflects in-progress state', () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), { testMode: true })
    const status = agent.getStatus()
    expect(status.sessionId).toBe(agent.sessionId)
    expect(status.progressPercent).toBe(0)
    expect(status.logs).toEqual([])
  })

  it('handles AI strategy parse failure as a hard error', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), {
      testMode: true,
      recordVideo: false,
    })
    // AI call order: cover letter, platform analysis, strategy, fields
    globalThis.__anthropicResponses.push(
      globalThis.__defaultAnthropicResponse(), // cover letter
      { content: [{ type: 'text', text: '{"platform":"ATS","confidence":"high"}' }] }, // platform
      { content: [{ type: 'text', text: 'no json here' }] }, // strategy — fails
    )
    await expect(agent.execute()).rejects.toThrow()
  })

  it('analyzeFieldsWithAI falls back when AI fails', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), { testMode: true })
    // create attempt so log() can insert into application_logs
    agent.attemptId = agent.createAttempt()
    globalThis.__anthropicResponses.push(new Error('boom'))
    const result = await agent.analyzeFieldsWithAI([{ label: 'name', inputType: 'text', required: true }])
    expect(result[0].confidence).toBe('low')
    expect(result[0].reason).toBe('AI analysis unavailable')
  })

  it('analyzeFieldsWithAI parses field-level recommendations', async () => {
    const job = seedJob()
    const agent = new AutoApplyAgent(job, defaultUserData(), { testMode: true })
    agent.attemptId = agent.createAttempt()
    globalThis.__anthropicResponses.push({
      content: [{ type: 'text', text: '[{"fieldIndex":1,"suggestedValue":"J","reason":"name","confidence":"high"}]' }],
    })
    const result = await agent.analyzeFieldsWithAI([{ label: 'name', inputType: 'text', required: true }])
    expect(result[0].suggestedValue).toBe('J')
    expect(result[0].confidence).toBe('high')
  })
})
