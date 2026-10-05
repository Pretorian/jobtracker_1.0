const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')
const db = new Database(dbPath)

console.log('🔄 Running document management migration...\n')

// Check if we need to migrate resume_generations table
const resumeTableInfo = db.prepare("PRAGMA table_info(resume_generations)").all()
const hasVersionColumn = resumeTableInfo.some(col => col.name === 'version')

if (!hasVersionColumn) {
  console.log('📋 Updating resume_generations table...')

  // Create new table with versioning
  db.exec(`
    CREATE TABLE IF NOT EXISTS resume_generations_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      filePath TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      type TEXT DEFAULT 'standard',
      fileSize INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `)

  // Copy existing data
  db.exec(`
    INSERT INTO resume_generations_new (id, jobId, filePath, version, createdAt)
    SELECT id, jobId, filePath, 1, createdAt
    FROM resume_generations;
  `)

  // Drop old table and rename new one
  db.exec(`
    DROP TABLE resume_generations;
    ALTER TABLE resume_generations_new RENAME TO resume_generations;
  `)

  console.log('  ✅ Resume table updated with versioning')
} else {
  console.log('  ✓ Resume table already has versioning')
}

// Create cover letter generations table
db.exec(`
  CREATE TABLE IF NOT EXISTS cover_letter_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    filePath TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    fileSize INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );
`)

console.log('  ✅ Cover letter table created')

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_resume_generations_jobId ON resume_generations(jobId);
  CREATE INDEX IF NOT EXISTS idx_resume_generations_version ON resume_generations(jobId, version);
  CREATE INDEX IF NOT EXISTS idx_cover_letter_generations_jobId ON cover_letter_generations(jobId);
  CREATE INDEX IF NOT EXISTS idx_cover_letter_generations_version ON cover_letter_generations(jobId, version);
`)

console.log('  ✅ Indexes created')

console.log('\n✅ Migration complete!')

db.close()
