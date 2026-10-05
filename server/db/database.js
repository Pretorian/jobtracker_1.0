const Database = require('better-sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Cache table for AI gap analyses. Keyed by jobId; `signature` is a hash of the
// inputs that affect the result (position fields + candidate resume/skills) so a
// stale cache is detected by a signature mismatch. Created here (idempotently) so
// it is always present without a separate migration step.
db.exec(`
  CREATE TABLE IF NOT EXISTS gap_analysis_cache (
    jobId INTEGER PRIMARY KEY,
    userId INTEGER,
    signature TEXT NOT NULL,
    analysis TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );
`)

// In test environments, enable WAL so concurrent connections see each
// others' commits without acquiring an exclusive write lock.
if (process.env.JOBS_DB_PATH) {
  db.pragma('journal_mode = WAL')
}

// ────────────────────────────────────────────────────────────────────────────────
// Jobs CRUD
// ────────────────────────────────────────────────────────────────────────────────

function getAllJobs(userId) {
  const jobs = db.prepare(`
    SELECT * FROM jobs
    WHERE userId = ?
    ORDER BY createdAt DESC
  `).all(userId)

  // Attach skills to each job
  for (const job of jobs) {
    job.keySkills = db.prepare('SELECT skill FROM job_skills WHERE jobId = ?')
      .all(job.id)
      .map(row => row.skill)
  }

  return jobs
}

function getJobById(id, userId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND userId = ?').get(id, userId)
  if (!job) return null

  job.keySkills = db.prepare('SELECT skill FROM job_skills WHERE jobId = ?')
    .all(id)
    .map(row => row.skill)

  return job
}

function createJob(jobData, userId) {
  const {
    company,
    title,
    location,
    type,
    salary,
    summary,
    fitScore,
    fitReason,
    url,
    keySkills = [],
    notes = '',
  } = jobData

  const now = new Date().toISOString().split('T')[0]

  const insert = db.prepare(`
    INSERT INTO jobs (
      company, title, location, type, salary, summary,
      fitScore, fitReason, url, status, savedDate, notes, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, ?)
  `)

  const result = insert.run(
    company, title, location, type, salary, summary,
    fitScore, fitReason, url, now, notes, userId
  )

  const jobId = result.lastInsertRowid

  // Insert skills
  if (keySkills.length > 0) {
    const insertSkill = db.prepare('INSERT INTO job_skills (jobId, skill) VALUES (?, ?)')
    for (const skill of keySkills) {
      insertSkill.run(jobId, skill)
    }
  }

  // Log activity
  logActivity(jobId, 'created', 'Job added to tracker')

  return getJobById(jobId, userId)
}

function updateJob(id, updates, userId) {
  const job = getJobById(id, userId)
  if (!job) throw new Error('Job not found')

  const {
    company,
    title,
    location,
    type,
    salary,
    summary,
    fitScore,
    fitReason,
    status,
    appliedDate,
    lastContact,
    notes,
    keySkills,
  } = updates

  db.prepare(`
    UPDATE jobs
    SET company = COALESCE(?, company),
        title = COALESCE(?, title),
        location = COALESCE(?, location),
        type = COALESCE(?, type),
        salary = COALESCE(?, salary),
        summary = COALESCE(?, summary),
        fitScore = COALESCE(?, fitScore),
        fitReason = COALESCE(?, fitReason),
        status = COALESCE(?, status),
        appliedDate = COALESCE(?, appliedDate),
        lastContact = COALESCE(?, lastContact),
        notes = COALESCE(?, notes),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    company, title, location, type, salary, summary, fitScore, fitReason,
    status, appliedDate, lastContact, notes, id
  )

  // Update skills if provided
  if (keySkills && Array.isArray(keySkills)) {
    // Delete existing skills
    db.prepare('DELETE FROM job_skills WHERE jobId = ?').run(id)

    // Insert new skills
    const insertSkill = db.prepare('INSERT INTO job_skills (jobId, skill) VALUES (?, ?)')
    for (const skill of keySkills) {
      insertSkill.run(id, skill)
    }
  }

  // Log activity if status changed
  if (status && status !== job.status) {
    logActivity(id, 'status_changed', `Status changed from ${job.status} to ${status}`)
  }

  // Log if reparsed (detected by multiple field changes)
  if (company || title || fitScore !== undefined) {
    logActivity(id, 'reparsed', 'Job details updated from source')
  }

  return getJobById(id, userId)
}

function deleteJob(id, userId) {
  const result = db.prepare('DELETE FROM jobs WHERE id = ? AND userId = ?').run(id, userId)
  return result.changes > 0
}

// ────────────────────────────────────────────────────────────────────────────────
// Activity Log
// ────────────────────────────────────────────────────────────────────────────────

function logActivity(jobId, action, details = null) {
  db.prepare(`
    INSERT INTO activity_log (jobId, action, details)
    VALUES (?, ?, ?)
  `).run(jobId, action, details)
}

function getJobActivity(jobId) {
  return db.prepare(`
    SELECT * FROM activity_log
    WHERE jobId = ?
    ORDER BY createdAt DESC
  `).all(jobId)
}

// ────────────────────────────────────────────────────────────────────────────────
// Follow-ups
// ────────────────────────────────────────────────────────────────────────────────

function getJobsNeedingFollowUp() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoffDate = sevenDaysAgo.toISOString().split('T')[0]

  const jobs = db.prepare(`
    SELECT * FROM jobs
    WHERE status IN ('applied', 'screening')
      AND appliedDate IS NOT NULL
      AND appliedDate <= ?
      AND (lastContact IS NULL OR lastContact <= ?)
    ORDER BY appliedDate ASC
  `).all(cutoffDate, cutoffDate)

  for (const job of jobs) {
    job.keySkills = db.prepare('SELECT skill FROM job_skills WHERE jobId = ?')
      .all(job.id)
      .map(row => row.skill)
  }

  return jobs
}

// ────────────────────────────────────────────────────────────────────────────────
// Document Management (Resumes & Cover Letters)
// ────────────────────────────────────────────────────────────────────────────────

const fs = require('fs')

function logResumeGeneration(jobId, filePath, type = 'standard') {
  // Get next version number
  const existing = db.prepare(`
    SELECT MAX(version) as maxVersion
    FROM resume_generations
    WHERE jobId = ?
  `).get(jobId)

  const version = (existing?.maxVersion || 0) + 1

  // Get file size if file exists
  let fileSize = null
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath)
    fileSize = stats.size
  }

  const result = db.prepare(`
    INSERT INTO resume_generations (jobId, filePath, version, type, fileSize)
    VALUES (?, ?, ?, ?, ?)
  `).run(jobId, filePath, version, type, fileSize)

  return db.prepare('SELECT * FROM resume_generations WHERE id = ?').get(result.lastInsertRowid)
}

function logCoverLetterGeneration(jobId, filePath) {
  // Get next version number
  const existing = db.prepare(`
    SELECT MAX(version) as maxVersion
    FROM cover_letter_generations
    WHERE jobId = ?
  `).get(jobId)

  const version = (existing?.maxVersion || 0) + 1

  // Get file size if file exists
  let fileSize = null
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath)
    fileSize = stats.size
  }

  const result = db.prepare(`
    INSERT INTO cover_letter_generations (jobId, filePath, version, fileSize)
    VALUES (?, ?, ?, ?)
  `).run(jobId, filePath, version, fileSize)

  return db.prepare('SELECT * FROM cover_letter_generations WHERE id = ?').get(result.lastInsertRowid)
}

function getResumeGenerations(jobId) {
  return db.prepare(`
    SELECT * FROM resume_generations
    WHERE jobId = ?
    ORDER BY version DESC
  `).all(jobId)
}

function getCoverLetterGenerations(jobId) {
  return db.prepare(`
    SELECT * FROM cover_letter_generations
    WHERE jobId = ?
    ORDER BY version DESC
  `).all(jobId)
}

function getLatestResume(jobId) {
  return db.prepare(`
    SELECT * FROM resume_generations
    WHERE jobId = ?
    ORDER BY version DESC
    LIMIT 1
  `).get(jobId)
}

function getLatestCoverLetter(jobId) {
  return db.prepare(`
    SELECT * FROM cover_letter_generations
    WHERE jobId = ?
    ORDER BY version DESC
    LIMIT 1
  `).get(jobId)
}

function deleteResumeVersion(id) {
  const resume = db.prepare('SELECT * FROM resume_generations WHERE id = ?').get(id)
  if (!resume) return false

  // Delete file if it exists
  if (fs.existsSync(resume.filePath)) {
    fs.unlinkSync(resume.filePath)
  }

  db.prepare('DELETE FROM resume_generations WHERE id = ?').run(id)
  return true
}

function deleteCoverLetterVersion(id) {
  const coverLetter = db.prepare('SELECT * FROM cover_letter_generations WHERE id = ?').get(id)
  if (!coverLetter) return false

  // Delete file if it exists
  if (fs.existsSync(coverLetter.filePath)) {
    fs.unlinkSync(coverLetter.filePath)
  }

  db.prepare('DELETE FROM cover_letter_generations WHERE id = ?').run(id)
  return true
}

function getDocumentStats(jobId) {
  const resumeCount = db.prepare(`
    SELECT COUNT(*) as count FROM resume_generations WHERE jobId = ?
  `).get(jobId)?.count || 0

  const coverLetterCount = db.prepare(`
    SELECT COUNT(*) as count FROM cover_letter_generations WHERE jobId = ?
  `).get(jobId)?.count || 0

  const latestResume = getLatestResume(jobId)
  const latestCoverLetter = getLatestCoverLetter(jobId)

  return {
    resumeCount,
    coverLetterCount,
    hasResume: resumeCount > 0,
    hasCoverLetter: coverLetterCount > 0,
    latestResume,
    latestCoverLetter
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Gap Items
// ────────────────────────────────────────────────────────────────────────────────

function createGapItem(gapData) {
  const { jobId, type, description, priority, notes } = gapData

  const insert = db.prepare(`
    INSERT INTO gap_items (jobId, type, description, priority, notes)
    VALUES (?, ?, ?, ?, ?)
  `)

  const result = insert.run(jobId, type, description, priority || 'medium', notes || '')
  return db.prepare('SELECT * FROM gap_items WHERE id = ?').get(result.lastInsertRowid)
}

function getGapItemsByJob(jobId) {
  return db.prepare(`
    SELECT * FROM gap_items
    WHERE jobId = ?
    ORDER BY
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      createdAt DESC
  `).all(jobId)
}

function getAllGapItems() {
  return db.prepare(`
    SELECT gi.*, j.company, j.title as jobTitle
    FROM gap_items gi
    JOIN jobs j ON gi.jobId = j.id
    ORDER BY
      CASE gi.status
        WHEN 'pending' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'completed' THEN 3
      END,
      CASE gi.priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      gi.createdAt DESC
  `).all()
}

function updateGapItem(id, updates) {
  const { status, completedDate, notes } = updates

  db.prepare(`
    UPDATE gap_items
    SET status = COALESCE(?, status),
        completedDate = COALESCE(?, completedDate),
        notes = COALESCE(?, notes),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, completedDate, notes, id)

  return db.prepare('SELECT * FROM gap_items WHERE id = ?').get(id)
}

function deleteGapItem(id) {
  const result = db.prepare('DELETE FROM gap_items WHERE id = ?').run(id)
  return result.changes > 0
}

// ────────────────────────────────────────────────────────────────────────────────
// Gap Action Plans
// ────────────────────────────────────────────────────────────────────────────────

function createActionPlan(planData) {
  const { jobId, gapItemId, prompt, response } = planData

  const insert = db.prepare(`
    INSERT INTO gap_action_plans (jobId, gapItemId, prompt, response)
    VALUES (?, ?, ?, ?)
  `)

  const result = insert.run(jobId, gapItemId || null, prompt, response)
  return db.prepare('SELECT * FROM gap_action_plans WHERE id = ?').get(result.lastInsertRowid)
}

function getActionPlansByJob(jobId) {
  return db.prepare(`
    SELECT * FROM gap_action_plans
    WHERE jobId = ?
    ORDER BY createdAt DESC
  `).all(jobId)
}

function getActionPlansByGapItem(gapItemId) {
  return db.prepare(`
    SELECT * FROM gap_action_plans
    WHERE gapItemId = ?
    ORDER BY createdAt DESC
  `).all(gapItemId)
}

// ────────────────────────────────────────────────────────────────────────────────
// Analytics & Status Tracking
// ────────────────────────────────────────────────────────────────────────────────

function getApplicationAnalytics() {
  // Get counts by status
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM jobs
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'saved' THEN 1
        WHEN 'applied' THEN 2
        WHEN 'screening' THEN 3
        WHEN 'interview' THEN 4
        WHEN 'offer' THEN 5
        WHEN 'accepted' THEN 6
        WHEN 'rejected' THEN 7
        WHEN 'withdrawn' THEN 8
        ELSE 9
      END
  `).all()

  // Get total applications
  const total = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count

  // Get active applications (not rejected/withdrawn/accepted)
  const active = db.prepare(`
    SELECT COUNT(*) as count FROM jobs
    WHERE status NOT IN ('rejected', 'withdrawn', 'accepted')
  `).get().count

  // Get conversion rates
  const applied = db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE status != 'saved'`).get().count
  const interviewed = db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE status IN ('interview', 'offer', 'accepted')`).get().count
  const offers = db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE status IN ('offer', 'accepted')`).get().count

  // Get average fit score
  const avgFitScore = db.prepare(`
    SELECT AVG(fitScore) as avg FROM jobs WHERE fitScore > 0
  `).get().avg || 0

  // Get status timeline (last 30 days)
  const timeline = db.prepare(`
    SELECT
      DATE(createdAt) as date,
      action,
      COUNT(*) as count
    FROM activity_log
    WHERE action = 'status_changed'
      AND createdAt >= date('now', '-30 days')
    GROUP BY date, action
    ORDER BY date DESC
  `).all()

  // Get average time in each status
  const avgTimeInStatus = db.prepare(`
    SELECT
      SUBSTR(details, INSTR(details, 'to ') + 3) as status,
      AVG(julianday('now') - julianday(createdAt)) as avg_days
    FROM activity_log
    WHERE action = 'status_changed'
    GROUP BY status
  `).all()

  // Get response rates (companies that responded)
  const companiesApplied = db.prepare(`
    SELECT COUNT(DISTINCT company) as count
    FROM jobs
    WHERE status != 'saved'
  `).get().count

  const companiesResponded = db.prepare(`
    SELECT COUNT(DISTINCT company) as count
    FROM jobs
    WHERE status IN ('screening', 'interview', 'offer', 'accepted', 'rejected')
  `).get().count

  return {
    total,
    active,
    statusCounts,
    conversionRates: {
      applicationToInterview: applied > 0 ? ((interviewed / applied) * 100).toFixed(1) : 0,
      interviewToOffer: interviewed > 0 ? ((offers / interviewed) * 100).toFixed(1) : 0,
      applicationToOffer: applied > 0 ? ((offers / applied) * 100).toFixed(1) : 0,
    },
    avgFitScore: avgFitScore.toFixed(1),
    avgTimeInStatus,
    timeline,
    responseRate: companiesApplied > 0 ? ((companiesResponded / companiesApplied) * 100).toFixed(1) : 0,
  }
}

function getStatusHistory(jobId) {
  return db.prepare(`
    SELECT * FROM activity_log
    WHERE jobId = ? AND action = 'status_changed'
    ORDER BY createdAt ASC
  `).all(jobId)
}

function getAllStatusHistory() {
  return db.prepare(`
    SELECT
      al.*,
      j.company,
      j.title
    FROM activity_log al
    JOIN jobs j ON al.jobId = j.id
    WHERE al.action = 'status_changed'
    ORDER BY al.createdAt DESC
  `).all()
}

function getTopCompanies(limit = 10) {
  return db.prepare(`
    SELECT
      company,
      COUNT(*) as applications,
      AVG(fitScore) as avgFitScore,
      SUM(CASE WHEN status IN ('interview', 'offer', 'accepted') THEN 1 ELSE 0 END) as interviews,
      SUM(CASE WHEN status IN ('offer', 'accepted') THEN 1 ELSE 0 END) as offers
    FROM jobs
    GROUP BY company
    ORDER BY applications DESC
    LIMIT ?
  `).all(limit)
}

function getTopSkills(limit = 20) {
  return db.prepare(`
    SELECT
      skill,
      COUNT(*) as jobCount,
      AVG(j.fitScore) as avgFitScore
    FROM job_skills js
    JOIN jobs j ON js.jobId = j.id
    GROUP BY skill
    ORDER BY jobCount DESC
    LIMIT ?
  `).all(limit)
}

function getApplicationTrends(days = 30) {
  return db.prepare(`
    SELECT
      DATE(createdAt) as date,
      COUNT(*) as count,
      AVG(fitScore) as avgFit
    FROM jobs
    WHERE createdAt >= date('now', '-' || ? || ' days')
    GROUP BY date
    ORDER BY date DESC
  `).all(days)
}

function exportApplicationData() {
  const jobs = db.prepare(`
    SELECT
      id,
      company,
      title,
      location,
      type,
      salary,
      status,
      fitScore,
      savedDate,
      appliedDate,
      lastContact,
      createdAt,
      updatedAt
    FROM jobs
    ORDER BY createdAt DESC
  `).all()

  // Attach skills and activity to each job
  for (const job of jobs) {
    job.skills = db.prepare('SELECT skill FROM job_skills WHERE jobId = ?')
      .all(job.id)
      .map(row => row.skill)
      .join(', ')

    job.activities = db.prepare('SELECT action, details, createdAt FROM activity_log WHERE jobId = ? ORDER BY createdAt DESC')
      .all(job.id)
  }

  return jobs
}

// ────────────────────────────────────────────────────────────────────────────────
// App Settings
// ────────────────────────────────────────────────────────────────────────────────

function getSettings() {
  let settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get()

  // If no settings exist, create defaults
  if (!settings) {
    db.prepare(`
      INSERT INTO app_settings (id, autoApplyMode, autoApplyRecordVideo, autoApplyHeadless, autoApplyAutoSubmit)
      VALUES (1, 'test', 1, 0, 0)
    `).run()
    settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get()
  }

  return settings
}

function updateSettings(newSettings) {
  const settings = getSettings()

  const updates = {
    autoApplyMode: newSettings.autoApplyMode !== undefined ? newSettings.autoApplyMode : settings.autoApplyMode,
    autoApplyRecordVideo: newSettings.autoApplyRecordVideo !== undefined ? (newSettings.autoApplyRecordVideo ? 1 : 0) : settings.autoApplyRecordVideo,
    autoApplyHeadless: newSettings.autoApplyHeadless !== undefined ? (newSettings.autoApplyHeadless ? 1 : 0) : settings.autoApplyHeadless,
    autoApplyAutoSubmit: newSettings.autoApplyAutoSubmit !== undefined ? (newSettings.autoApplyAutoSubmit ? 1 : 0) : settings.autoApplyAutoSubmit
  }

  db.prepare(`
    UPDATE app_settings
    SET
      autoApplyMode = ?,
      autoApplyRecordVideo = ?,
      autoApplyHeadless = ?,
      autoApplyAutoSubmit = ?,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    updates.autoApplyMode,
    updates.autoApplyRecordVideo,
    updates.autoApplyHeadless,
    updates.autoApplyAutoSubmit
  )

  return getSettings()
}

// ────────────────────────────────────────────────────────────────────────────────
// Application Attempts & Agent Tracking
// ────────────────────────────────────────────────────────────────────────────────

function getApplicationAttempts(jobId) {
  return db.prepare(`
    SELECT * FROM application_attempts
    WHERE jobId = ?
    ORDER BY startedAt DESC
  `).all(jobId)
}

function getApplicationAttemptById(attemptId) {
  return db.prepare(`
    SELECT * FROM application_attempts WHERE id = ?
  `).get(attemptId)
}

function getApplicationLogs(attemptId) {
  return db.prepare(`
    SELECT * FROM application_logs
    WHERE attemptId = ?
    ORDER BY timestamp ASC
  `).all(attemptId)
}

function getAgentSession(sessionId) {
  return db.prepare(`
    SELECT * FROM agent_sessions WHERE id = ?
  `).get(sessionId)
}

function getActiveAgentSessions() {
  return db.prepare(`
    SELECT * FROM agent_sessions
    WHERE status = 'running'
    ORDER BY createdAt DESC
  `).all()
}

function getAgentSessionsByJob(jobId) {
  return db.prepare(`
    SELECT * FROM agent_sessions
    WHERE jobId = ?
    ORDER BY createdAt DESC
  `).all(jobId)
}

function getRecentApplicationAttempts(limit = 10) {
  const attempts = db.prepare(`
    SELECT
      aa.*,
      j.title,
      j.company,
      j.url
    FROM application_attempts aa
    JOIN jobs j ON aa.jobId = j.id
    ORDER BY aa.startedAt DESC
    LIMIT ?
  `).all(limit)

  return attempts
}

function getApplicationStats() {
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM application_attempts
  `).get()?.count || 0

  const successful = db.prepare(`
    SELECT COUNT(*) as count FROM application_attempts
    WHERE success = 1
  `).get()?.count || 0

  const submitted = db.prepare(`
    SELECT COUNT(*) as count FROM application_attempts
    WHERE submitted = 1
  `).get()?.count || 0

  const inProgress = db.prepare(`
    SELECT COUNT(*) as count FROM application_attempts
    WHERE status = 'in_progress'
  `).get()?.count || 0

  const avgDuration = db.prepare(`
    SELECT AVG(
      (julianday(completedAt) - julianday(startedAt)) * 24 * 60 * 60
    ) as avgSeconds
    FROM application_attempts
    WHERE completedAt IS NOT NULL
  `).get()?.avgSeconds || 0

  return {
    total,
    successful,
    submitted,
    inProgress,
    failed: total - successful,
    successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
    avgDuration: Math.round(avgDuration)
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Authentication
// ────────────────────────────────────────────────────────────────────────────────

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username)
}

function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword)
}

function updateUserPassword(username, newPassword) {
  const hashedPassword = bcrypt.hashSync(newPassword, 10)
  db.prepare(`
    UPDATE users
    SET password = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE username = ?
  `).run(hashedPassword, username)
  return true
}

// ────────────────────────────────────────────────────────────────────────────────
// Gap Analysis Cache
// ────────────────────────────────────────────────────────────────────────────────

// Return the cached gap analysis for a job, or null if none. The `analysis`
// field is parsed back into an object.
function getGapAnalysisCache(jobId, userId) {
  const row = db.prepare(
    'SELECT * FROM gap_analysis_cache WHERE jobId = ? AND userId = ?'
  ).get(jobId, userId)
  if (!row) return null
  return {
    jobId: row.jobId,
    signature: row.signature,
    analysis: JSON.parse(row.analysis),
    createdAt: row.createdAt,
  }
}

// Upsert the cached gap analysis for a job along with the input signature used
// to detect staleness.
function saveGapAnalysisCache(jobId, userId, signature, analysis) {
  db.prepare(`
    INSERT INTO gap_analysis_cache (jobId, userId, signature, analysis, createdAt)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(jobId) DO UPDATE SET
      userId = excluded.userId,
      signature = excluded.signature,
      analysis = excluded.analysis,
      createdAt = CURRENT_TIMESTAMP
  `).run(jobId, userId, signature, JSON.stringify(analysis))
}

module.exports = {
  db,
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  logActivity,
  getJobActivity,
  getJobsNeedingFollowUp,
  // Document Management
  logResumeGeneration,
  logCoverLetterGeneration,
  getResumeGenerations,
  getCoverLetterGenerations,
  getLatestResume,
  getLatestCoverLetter,
  deleteResumeVersion,
  deleteCoverLetterVersion,
  getDocumentStats,
  // Gap Items
  createGapItem,
  getGapItemsByJob,
  getAllGapItems,
  updateGapItem,
  deleteGapItem,
  createActionPlan,
  getActionPlansByJob,
  getActionPlansByGapItem,
  // Gap Analysis Cache
  getGapAnalysisCache,
  saveGapAnalysisCache,
  // Analytics & Tracking
  getApplicationAnalytics,
  getStatusHistory,
  getAllStatusHistory,
  getTopCompanies,
  getTopSkills,
  getApplicationTrends,
  exportApplicationData,
  // Application Attempts & Agent Tracking
  getApplicationAttempts,
  getApplicationAttemptById,
  getApplicationLogs,
  getAgentSession,
  getActiveAgentSessions,
  getAgentSessionsByJob,
  getRecentApplicationAttempts,
  getApplicationStats,
  // App Settings
  getSettings,
  updateSettings,
  // Authentication
  getUserByUsername,
  verifyPassword,
  updateUserPassword,
}
