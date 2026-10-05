import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

// Migration scripts run side-effectfully on import. They each open a NEW
// connection to the file at process.env.JOBS_DB_PATH, mutate schema/data,
// and close. To execute each one independently, we point JOBS_DB_PATH at a
// fresh temp file, then clear Node's require cache so the script re-runs.

const migrations = [
  '../server/db/init',
  '../server/db/migrate-auth',
  '../server/db/migrate-multi-user',
  '../server/db/migrate-documents',
  '../server/db/migrate-settings',
  '../server/db/migrate-application-tracking',
]

function freshTmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'))
  return path.join(dir, 'db.sqlite')
}

function runMigration(modulePath, dbPath) {
  process.env.JOBS_DB_PATH = dbPath
  const resolved = require.resolve(modulePath)
  delete require.cache[resolved]
  require(modulePath)
}

describe('db migration scripts', () => {
  const originalDbPath = process.env.JOBS_DB_PATH

  beforeEach(() => {
    process.env.JOBS_DB_PATH = originalDbPath
  })

  it('init.js creates all base tables', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)

    const db = new Database(dbPath, { readonly: true })
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    expect(tables).toContain('jobs')
    expect(tables).toContain('job_skills')
    expect(tables).toContain('activity_log')
    expect(tables).toContain('resume_generations')
    expect(tables).toContain('gap_items')
    expect(tables).toContain('gap_action_plans')
    db.close()
  })

  it('migrate-auth.js creates users table and seeds admin', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-auth', dbPath)

    const db = new Database(dbPath, { readonly: true })
    const admin = db.prepare("SELECT username FROM users WHERE username = 'admin'").get()
    expect(admin.username).toBe('admin')
    db.close()
  })

  it('migrate-auth.js is idempotent', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-auth', dbPath)
    runMigration('../server/db/migrate-auth', dbPath) // re-run

    const db = new Database(dbPath, { readonly: true })
    const count = db.prepare("SELECT COUNT(*) as c FROM users WHERE username = 'admin'").get().c
    expect(count).toBe(1)
    db.close()
  })

  it('migrate-multi-user.js adds userId column and assigns jobs to admin', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-auth', dbPath)
    runMigration('../server/db/migrate-multi-user', dbPath)

    const db = new Database(dbPath, { readonly: true })
    const cols = db.prepare("PRAGMA table_info(jobs)").all().map(c => c.name)
    expect(cols).toContain('userId')
    const users = db.prepare('SELECT username FROM users').all().map(u => u.username)
    expect(users).toEqual(['admin'])
    db.close()
  })

  it('migrate-multi-user.js is idempotent and reassigns existing jobs', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-auth', dbPath)
    // Insert a job before adding userId, simulating an existing record
    const conn = new Database(dbPath)
    conn.prepare(`INSERT INTO jobs (company, title) VALUES ('X', 'Y')`).run()
    conn.close()
    runMigration('../server/db/migrate-multi-user', dbPath)
    runMigration('../server/db/migrate-multi-user', dbPath) // re-run

    const db = new Database(dbPath, { readonly: true })
    const jobs = db.prepare('SELECT userId FROM jobs').all()
    expect(jobs[0].userId).toBeTruthy()
    db.close()
  })

  it('migrate-documents.js upgrades resume_generations schema', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-documents', dbPath)

    const db = new Database(dbPath, { readonly: true })
    const cols = db.prepare("PRAGMA table_info(resume_generations)").all().map(c => c.name)
    expect(cols).toContain('version')
    const clCols = db.prepare("PRAGMA table_info(cover_letter_generations)").all().map(c => c.name)
    expect(clCols).toContain('version')
    db.close()
  })

  it('migrate-documents.js is idempotent', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-documents', dbPath)
    runMigration('../server/db/migrate-documents', dbPath) // re-run
    // No throw = ok
  })

  it('migrate-settings.js creates app_settings with defaults', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-settings', dbPath)

    const db = new Database(dbPath, { readonly: true })
    const s = db.prepare("SELECT * FROM app_settings WHERE id = 1").get()
    expect(s.autoApplyMode).toBe('test')
    db.close()
  })

  it('migrate-application-tracking.js creates tracking tables', () => {
    const dbPath = freshTmpDb()
    runMigration('../server/db/init', dbPath)
    runMigration('../server/db/migrate-application-tracking', dbPath)

    const db = new Database(dbPath, { readonly: true })
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    expect(tables).toContain('application_attempts')
    expect(tables).toContain('application_logs')
    expect(tables).toContain('agent_sessions')
    db.close()
  })
})
