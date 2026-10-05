import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const dbModule = require('../server/db/database')
const {
  db,
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  logActivity,
  getJobActivity,
  getJobsNeedingFollowUp,
  logResumeGeneration,
  logCoverLetterGeneration,
  getResumeGenerations,
  getCoverLetterGenerations,
  getLatestResume,
  getLatestCoverLetter,
  deleteResumeVersion,
  deleteCoverLetterVersion,
  getDocumentStats,
  createGapItem,
  getGapItemsByJob,
  getAllGapItems,
  updateGapItem,
  deleteGapItem,
  createActionPlan,
  getActionPlansByJob,
  getActionPlansByGapItem,
  getApplicationAnalytics,
  getStatusHistory,
  getAllStatusHistory,
  getTopCompanies,
  getTopSkills,
  getApplicationTrends,
  exportApplicationData,
  getApplicationAttempts,
  getApplicationAttemptById,
  getApplicationLogs,
  getAgentSession,
  getActiveAgentSessions,
  getAgentSessionsByJob,
  getRecentApplicationAttempts,
  getApplicationStats,
  getSettings,
  updateSettings,
  getUserByUsername,
  verifyPassword,
  updateUserPassword,
} = dbModule

const bcrypt = require('bcrypt')

function seedUser(username = 'tester', password = 'password123') {
  const hashed = bcrypt.hashSync(password, 4)
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed)
  return { id: result.lastInsertRowid, username, password }
}

function makeJob(overrides = {}) {
  return {
    company: 'Acme',
    title: 'Software Engineer',
    location: 'Remote',
    type: 'Full-time',
    salary: '$120k',
    summary: 'Build things',
    fitScore: 80,
    fitReason: 'Good match',
    url: 'https://example.com/job/1',
    keySkills: ['JS', 'Node'],
    notes: 'test note',
    ...overrides,
  }
}

describe('database.js', () => {
  let userId

  beforeEach(() => {
    userId = seedUser().id
  })

  describe('jobs CRUD', () => {
    it('creates and reads a job with skills', () => {
      const created = createJob(makeJob(), userId)
      expect(created.id).toBeTypeOf('number')
      expect(created.company).toBe('Acme')
      expect(created.keySkills).toEqual(['JS', 'Node'])
      expect(created.status).toBe('saved')

      const found = getJobById(created.id, userId)
      expect(found.id).toBe(created.id)
      expect(found.keySkills).toEqual(['JS', 'Node'])
    })

    it('creates a job with default empty skills/notes', () => {
      const created = createJob(
        { company: 'C', title: 'T', location: 'L', type: 'FT', salary: '', summary: '', fitScore: 0, fitReason: '', url: '' },
        userId
      )
      expect(created.keySkills).toEqual([])
    })

    it('getAllJobs returns user jobs ordered by createdAt DESC', () => {
      createJob(makeJob({ company: 'A' }), userId)
      createJob(makeJob({ company: 'B' }), userId)
      const otherUser = seedUser('other').id
      createJob(makeJob({ company: 'C' }), otherUser)

      const jobs = getAllJobs(userId)
      expect(jobs).toHaveLength(2)
      expect(jobs.map(j => j.company).sort()).toEqual(['A', 'B'])
      expect(jobs[0].keySkills).toBeInstanceOf(Array)
    })

    it('getJobById returns null for missing job', () => {
      expect(getJobById(9999, userId)).toBeNull()
    })

    it('getJobById enforces user ownership', () => {
      const job = createJob(makeJob(), userId)
      const otherUser = seedUser('other').id
      expect(getJobById(job.id, otherUser)).toBeNull()
    })

    it('updates a job and logs activity on status change', () => {
      const job = createJob(makeJob(), userId)
      const updated = updateJob(job.id, { status: 'applied', appliedDate: '2026-01-01' }, userId)
      expect(updated.status).toBe('applied')
      expect(updated.appliedDate).toBe('2026-01-01')

      const activity = getJobActivity(job.id)
      const statusActivity = activity.find(a => a.action === 'status_changed')
      expect(statusActivity).toBeTruthy()
      expect(statusActivity.details).toContain('applied')
    })

    it('updates job skills (replaces existing)', () => {
      const job = createJob(makeJob({ keySkills: ['A', 'B'] }), userId)
      const updated = updateJob(job.id, { keySkills: ['X', 'Y', 'Z'] }, userId)
      expect(updated.keySkills.sort()).toEqual(['X', 'Y', 'Z'])
    })

    it('updateJob throws when job is missing', () => {
      expect(() => updateJob(9999, { status: 'applied' }, userId)).toThrow('Job not found')
    })

    it('partial updates preserve unchanged fields via COALESCE', () => {
      const job = createJob(makeJob({ company: 'Original' }), userId)
      const updated = updateJob(job.id, { title: 'New Title' }, userId)
      expect(updated.company).toBe('Original')
      expect(updated.title).toBe('New Title')
    })

    it('deletes a job and returns true', () => {
      const job = createJob(makeJob(), userId)
      expect(deleteJob(job.id, userId)).toBe(true)
      expect(getJobById(job.id, userId)).toBeNull()
    })

    it('deleteJob returns false when nothing deleted', () => {
      expect(deleteJob(9999, userId)).toBe(false)
    })

    it('deleteJob respects user ownership', () => {
      const job = createJob(makeJob(), userId)
      const otherUser = seedUser('other').id
      expect(deleteJob(job.id, otherUser)).toBe(false)
    })
  })

  describe('activity & follow-ups', () => {
    it('logs activity and retrieves it', () => {
      const job = createJob(makeJob(), userId)
      logActivity(job.id, 'note_added', 'something happened')
      const activity = getJobActivity(job.id)
      expect(activity.length).toBeGreaterThanOrEqual(2)
      expect(activity.some(a => a.action === 'note_added')).toBe(true)
    })

    it('getJobsNeedingFollowUp finds applied jobs older than 7 days', () => {
      const job = createJob(makeJob(), userId)
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      db.prepare('UPDATE jobs SET status = ?, appliedDate = ? WHERE id = ?').run('applied', eightDaysAgo, job.id)

      const followUps = getJobsNeedingFollowUp()
      expect(followUps.length).toBe(1)
      expect(followUps[0].id).toBe(job.id)
      expect(followUps[0].keySkills).toBeInstanceOf(Array)
    })

    it('getJobsNeedingFollowUp excludes recent applies', () => {
      const job = createJob(makeJob(), userId)
      const today = new Date().toISOString().split('T')[0]
      db.prepare('UPDATE jobs SET status = ?, appliedDate = ? WHERE id = ?').run('applied', today, job.id)
      expect(getJobsNeedingFollowUp()).toHaveLength(0)
    })
  })

  describe('document management', () => {
    let jobId
    let tmpFile

    beforeEach(() => {
      jobId = createJob(makeJob(), userId).id
      tmpFile = path.join(global.__TEST_TMP_DIR__, `f-${Date.now()}.docx`)
      fs.writeFileSync(tmpFile, 'fake-content')
    })

    it('logs resume generation, increments versions, and tracks file size', () => {
      const v1 = logResumeGeneration(jobId, tmpFile, 'standard')
      const v2 = logResumeGeneration(jobId, tmpFile, 'optimized')
      expect(v1.version).toBe(1)
      expect(v2.version).toBe(2)
      expect(v1.fileSize).toBeGreaterThan(0)

      const all = getResumeGenerations(jobId)
      expect(all).toHaveLength(2)
      expect(all[0].version).toBe(2)

      const latest = getLatestResume(jobId)
      expect(latest.version).toBe(2)
    })

    it('logResumeGeneration handles missing files', () => {
      const r = logResumeGeneration(jobId, '/tmp/does-not-exist.docx', 'standard')
      expect(r.fileSize).toBeNull()
    })

    it('logs cover letter generation, increments versions', () => {
      const v1 = logCoverLetterGeneration(jobId, tmpFile)
      const v2 = logCoverLetterGeneration(jobId, tmpFile)
      expect(v1.version).toBe(1)
      expect(v2.version).toBe(2)

      expect(getCoverLetterGenerations(jobId)).toHaveLength(2)
      expect(getLatestCoverLetter(jobId).version).toBe(2)
    })

    it('logCoverLetterGeneration handles missing files', () => {
      const r = logCoverLetterGeneration(jobId, '/tmp/missing.docx')
      expect(r.fileSize).toBeNull()
    })

    it('deletes resume version and removes file', () => {
      const v = logResumeGeneration(jobId, tmpFile, 'standard')
      expect(fs.existsSync(tmpFile)).toBe(true)
      expect(deleteResumeVersion(v.id)).toBe(true)
      expect(fs.existsSync(tmpFile)).toBe(false)
    })

    it('deleteResumeVersion returns false for missing id', () => {
      expect(deleteResumeVersion(9999)).toBe(false)
    })

    it('deleteResumeVersion handles missing file gracefully', () => {
      const v = logResumeGeneration(jobId, '/tmp/missing.docx', 'standard')
      expect(deleteResumeVersion(v.id)).toBe(true)
    })

    it('deletes cover letter version and removes file', () => {
      const v = logCoverLetterGeneration(jobId, tmpFile)
      expect(deleteCoverLetterVersion(v.id)).toBe(true)
      expect(fs.existsSync(tmpFile)).toBe(false)
    })

    it('deleteCoverLetterVersion returns false for missing id', () => {
      expect(deleteCoverLetterVersion(9999)).toBe(false)
    })

    it('deleteCoverLetterVersion handles missing file gracefully', () => {
      const v = logCoverLetterGeneration(jobId, '/tmp/missing-cv.docx')
      expect(deleteCoverLetterVersion(v.id)).toBe(true)
    })

    it('getDocumentStats reflects counts and existence', () => {
      const empty = getDocumentStats(jobId)
      expect(empty.resumeCount).toBe(0)
      expect(empty.coverLetterCount).toBe(0)
      expect(empty.hasResume).toBe(false)
      expect(empty.hasCoverLetter).toBe(false)

      logResumeGeneration(jobId, tmpFile, 'standard')
      logCoverLetterGeneration(jobId, tmpFile)
      const stats = getDocumentStats(jobId)
      expect(stats.resumeCount).toBe(1)
      expect(stats.coverLetterCount).toBe(1)
      expect(stats.hasResume).toBe(true)
      expect(stats.hasCoverLetter).toBe(true)
      expect(stats.latestResume).toBeTruthy()
      expect(stats.latestCoverLetter).toBeTruthy()
    })
  })

  describe('gap items & action plans', () => {
    let jobId

    beforeEach(() => {
      jobId = createJob(makeJob(), userId).id
    })

    it('creates gap item with defaults', () => {
      const item = createGapItem({ jobId, type: 'skill', description: 'learn rust' })
      expect(item.priority).toBe('medium')
      expect(item.status).toBe('pending')
      expect(item.notes).toBe('')
    })

    it('creates gap item with custom priority and notes', () => {
      const item = createGapItem({ jobId, type: 'skill', description: 'd', priority: 'high', notes: 'soon' })
      expect(item.priority).toBe('high')
      expect(item.notes).toBe('soon')
    })

    it('lists gap items by job ordered by priority', () => {
      createGapItem({ jobId, type: 'skill', description: 'low', priority: 'low' })
      createGapItem({ jobId, type: 'skill', description: 'high', priority: 'high' })
      createGapItem({ jobId, type: 'skill', description: 'mid', priority: 'medium' })

      const items = getGapItemsByJob(jobId)
      expect(items.map(i => i.priority)).toEqual(['high', 'medium', 'low'])
    })

    it('getAllGapItems joins job info', () => {
      createGapItem({ jobId, type: 'skill', description: 'learn x', priority: 'high' })
      const all = getAllGapItems()
      expect(all[0].company).toBe('Acme')
      expect(all[0].jobTitle).toBe('Software Engineer')
    })

    it('updates gap item status and completedDate', () => {
      const item = createGapItem({ jobId, type: 'skill', description: 'd' })
      const updated = updateGapItem(item.id, { status: 'completed', completedDate: '2026-05-10', notes: 'done' })
      expect(updated.status).toBe('completed')
      expect(updated.completedDate).toBe('2026-05-10')
      expect(updated.notes).toBe('done')
    })

    it('deletes gap item', () => {
      const item = createGapItem({ jobId, type: 'skill', description: 'd' })
      expect(deleteGapItem(item.id)).toBe(true)
      expect(deleteGapItem(9999)).toBe(false)
    })

    it('creates and retrieves action plans', () => {
      const plan = createActionPlan({ jobId, prompt: 'how', response: '{"x":1}' })
      expect(plan.id).toBeTypeOf('number')

      const byJob = getActionPlansByJob(jobId)
      expect(byJob).toHaveLength(1)
    })

    it('action plans can be queried by gapItemId', () => {
      const item = createGapItem({ jobId, type: 'skill', description: 'd' })
      createActionPlan({ jobId, gapItemId: item.id, prompt: 'p', response: '{}' })
      const byGap = getActionPlansByGapItem(item.id)
      expect(byGap).toHaveLength(1)
    })
  })

  describe('analytics', () => {
    beforeEach(() => {
      const j1 = createJob(makeJob({ company: 'A', fitScore: 80 }), userId)
      const j2 = createJob(makeJob({ company: 'B', fitScore: 60 }), userId)
      const j3 = createJob(makeJob({ company: 'A', fitScore: 90 }), userId)
      updateJob(j1.id, { status: 'applied' }, userId)
      updateJob(j2.id, { status: 'interview' }, userId)
      updateJob(j3.id, { status: 'offer' }, userId)
    })

    it('getApplicationAnalytics returns aggregate counts', () => {
      const a = getApplicationAnalytics()
      expect(a.total).toBe(3)
      expect(a.statusCounts).toBeInstanceOf(Array)
      expect(a.conversionRates).toBeTruthy()
      expect(parseFloat(a.avgFitScore)).toBeGreaterThan(0)
    })

    it('getStatusHistory returns status changes for a job', () => {
      const job = createJob(makeJob(), userId)
      updateJob(job.id, { status: 'applied' }, userId)
      updateJob(job.id, { status: 'interview' }, userId)
      const history = getStatusHistory(job.id)
      expect(history.length).toBeGreaterThanOrEqual(2)
    })

    it('getAllStatusHistory returns history with company/title', () => {
      const all = getAllStatusHistory()
      expect(all.length).toBeGreaterThan(0)
      expect(all[0].company).toBeTruthy()
    })

    it('getTopCompanies aggregates by company', () => {
      const top = getTopCompanies(5)
      const a = top.find(t => t.company === 'A')
      expect(a.applications).toBe(2)
    })

    it('getTopSkills aggregates by skill', () => {
      const top = getTopSkills(5)
      expect(top.length).toBeGreaterThan(0)
      expect(top[0].jobCount).toBeGreaterThan(0)
    })

    it('getApplicationTrends returns date buckets', () => {
      const trends = getApplicationTrends(30)
      expect(trends.length).toBeGreaterThan(0)
    })

    it('exportApplicationData returns flat job rows with skills + activities', () => {
      const data = exportApplicationData()
      expect(data.length).toBeGreaterThan(0)
      expect(typeof data[0].skills).toBe('string')
      expect(Array.isArray(data[0].activities)).toBe(true)
    })
  })

  describe('application attempts / agent sessions', () => {
    let jobId

    beforeEach(() => {
      jobId = createJob(makeJob(), userId).id
      db.prepare(`
        INSERT INTO application_attempts (jobId, status, success, submitted, startedAt, completedAt)
        VALUES (?, 'completed', 1, 1, datetime('now', '-1 hour'), datetime('now'))
      `).run(jobId)
      db.prepare(`
        INSERT INTO application_attempts (jobId, status, success, submitted, startedAt)
        VALUES (?, 'in_progress', 0, 0, datetime('now'))
      `).run(jobId)
      db.prepare(`
        INSERT INTO agent_sessions (id, jobId, status)
        VALUES ('sess-1', ?, 'running')
      `).run(jobId)
      db.prepare(`
        INSERT INTO agent_sessions (id, jobId, status)
        VALUES ('sess-2', ?, 'completed')
      `).run(jobId)
      db.prepare(`
        INSERT INTO application_logs (attemptId, level, step, message)
        VALUES (1, 'info', 'start', 'msg')
      `).run()
    })

    it('getApplicationAttempts returns attempts for job', () => {
      const attempts = getApplicationAttempts(jobId)
      expect(attempts).toHaveLength(2)
    })

    it('getApplicationAttemptById returns single attempt', () => {
      const attempt = getApplicationAttemptById(1)
      expect(attempt.jobId).toBe(jobId)
    })

    it('getApplicationLogs returns logs', () => {
      const logs = getApplicationLogs(1)
      expect(logs).toHaveLength(1)
    })

    it('getAgentSession returns session by id', () => {
      const s = getAgentSession('sess-1')
      expect(s.jobId).toBe(jobId)
    })

    it('getActiveAgentSessions returns only running', () => {
      const sessions = getActiveAgentSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].status).toBe('running')
    })

    it('getAgentSessionsByJob returns sessions for job', () => {
      expect(getAgentSessionsByJob(jobId)).toHaveLength(2)
    })

    it('getRecentApplicationAttempts joins job info', () => {
      const recent = getRecentApplicationAttempts(5)
      expect(recent[0].title).toBeTruthy()
    })

    it('getApplicationStats reports counts and rate', () => {
      const stats = getApplicationStats()
      expect(stats.total).toBe(2)
      expect(stats.successful).toBe(1)
      expect(stats.inProgress).toBe(1)
      expect(parseFloat(stats.successRate)).toBe(50)
    })

    it('getApplicationStats handles empty DB', () => {
      global.__resetDb()
      const stats = getApplicationStats()
      expect(stats.total).toBe(0)
      expect(stats.successRate).toBe(0)
    })
  })

  describe('app settings', () => {
    it('getSettings inserts defaults on first call', () => {
      const s = getSettings()
      expect(s.id).toBe(1)
      expect(s.autoApplyMode).toBe('test')
      expect(s.autoApplyRecordVideo).toBe(1)
    })

    it('updateSettings merges values and coerces booleans', () => {
      getSettings()
      const updated = updateSettings({
        autoApplyMode: 'live',
        autoApplyRecordVideo: false,
        autoApplyHeadless: true,
        autoApplyAutoSubmit: true,
      })
      expect(updated.autoApplyMode).toBe('live')
      expect(updated.autoApplyRecordVideo).toBe(0)
      expect(updated.autoApplyHeadless).toBe(1)
      expect(updated.autoApplyAutoSubmit).toBe(1)
    })

    it('updateSettings preserves unchanged keys', () => {
      getSettings()
      updateSettings({ autoApplyMode: 'live' })
      const next = updateSettings({ autoApplyRecordVideo: false })
      expect(next.autoApplyMode).toBe('live')
      expect(next.autoApplyRecordVideo).toBe(0)
    })
  })

  describe('authentication', () => {
    it('getUserByUsername returns the user', () => {
      const u = getUserByUsername('tester')
      expect(u.username).toBe('tester')
    })

    it('returns undefined for missing user', () => {
      expect(getUserByUsername('nope')).toBeFalsy()
    })

    it('verifyPassword returns true on match, false otherwise', () => {
      const u = getUserByUsername('tester')
      expect(verifyPassword('password123', u.password)).toBe(true)
      expect(verifyPassword('wrong', u.password)).toBe(false)
    })

    it('updateUserPassword changes the hash', () => {
      const before = getUserByUsername('tester')
      updateUserPassword('tester', 'newpassword')
      const after = getUserByUsername('tester')
      expect(after.password).not.toBe(before.password)
      expect(verifyPassword('newpassword', after.password)).toBe(true)
    })
  })
})
