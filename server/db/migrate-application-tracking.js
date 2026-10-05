const Database = require('better-sqlite3')
const path = require('path')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')
const db = new Database(dbPath)

console.log('\n📦 Migrating database for application tracking...\n')

// Create application_attempts table
db.exec(`
  CREATE TABLE IF NOT EXISTS application_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    startedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    completedAt TEXT,
    agentSessionId TEXT,

    -- Progress tracking
    currentStep TEXT,
    progress INTEGER DEFAULT 0,
    totalSteps INTEGER DEFAULT 4,

    -- Results
    success INTEGER DEFAULT 0,
    submitted INTEGER DEFAULT 0,
    error TEXT,

    -- Generated files
    resumePath TEXT,
    coverLetterPath TEXT,

    -- Video recording
    videoPath TEXT,
    videoDuration INTEGER,
    videoSize INTEGER,

    -- Form data
    formAnalysis TEXT,
    fieldsFilled INTEGER DEFAULT 0,
    totalFields INTEGER DEFAULT 0,
    fieldsAnalysis TEXT,

    -- Metadata
    metadata TEXT,
    logs TEXT,

    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );
`)

// Create application_logs table for detailed step-by-step logs
db.exec(`
  CREATE TABLE IF NOT EXISTS application_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attemptId INTEGER NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    level TEXT DEFAULT 'info',
    step TEXT,
    message TEXT,
    data TEXT,

    FOREIGN KEY (attemptId) REFERENCES application_attempts(id) ON DELETE CASCADE
  );
`)

// Create agent_sessions table for tracking agent state
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    jobId INTEGER NOT NULL,
    status TEXT DEFAULT 'running',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Agent state
    currentAction TEXT,
    context TEXT,
    decisions TEXT,

    -- Performance metrics
    tokensUsed INTEGER DEFAULT 0,
    apiCalls INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,

    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );
`)

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_application_attempts_jobId ON application_attempts(jobId);
  CREATE INDEX IF NOT EXISTS idx_application_attempts_status ON application_attempts(status);
  CREATE INDEX IF NOT EXISTS idx_application_attempts_session ON application_attempts(agentSessionId);
  CREATE INDEX IF NOT EXISTS idx_application_logs_attemptId ON application_logs(attemptId);
  CREATE INDEX IF NOT EXISTS idx_agent_sessions_jobId ON agent_sessions(jobId);
  CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
`)

console.log('✅ Migration complete!\n')
console.log('Created tables:')
console.log('  • application_attempts - Track each application attempt')
console.log('  • application_logs - Detailed step logs')
console.log('  • agent_sessions - Track agent execution state\n')

db.close()
