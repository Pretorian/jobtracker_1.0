const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')

// Ensure data directory exists
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)

// Create tables
const schema = `
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    type TEXT,
    salary TEXT,
    summary TEXT,
    fitScore INTEGER DEFAULT 0,
    fitReason TEXT,
    url TEXT,
    status TEXT DEFAULT 'saved',
    savedDate TEXT,
    appliedDate TEXT,
    lastContact TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS job_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    skill TEXT NOT NULL,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS resume_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    filePath TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gap_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    completedDate TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gap_action_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    gapItemId INTEGER,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (gapItemId) REFERENCES gap_items(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_appliedDate ON jobs(appliedDate);
  CREATE INDEX IF NOT EXISTS idx_job_skills_jobId ON job_skills(jobId);
  CREATE INDEX IF NOT EXISTS idx_gap_items_jobId ON gap_items(jobId);
  CREATE INDEX IF NOT EXISTS idx_gap_items_status ON gap_items(status);
  CREATE INDEX IF NOT EXISTS idx_gap_action_plans_jobId ON gap_action_plans(jobId);
`

db.exec(schema)

console.log('✅ Database initialized successfully at:', dbPath)
console.log('Tables created: jobs, job_skills, activity_log, resume_generations')

db.close()
