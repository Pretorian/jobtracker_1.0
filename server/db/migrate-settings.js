const Database = require('better-sqlite3')
const path = require('path')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')
const db = new Database(dbPath)

console.log('\n⚙️  Creating settings table...\n')

// Create settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    -- Auto-apply settings
    autoApplyMode TEXT DEFAULT 'test',
    autoApplyRecordVideo INTEGER DEFAULT 1,
    autoApplyHeadless INTEGER DEFAULT 0,
    autoApplyAutoSubmit INTEGER DEFAULT 0,

    -- Other settings
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

// Insert default settings if not exists
db.exec(`
  INSERT OR IGNORE INTO app_settings (id, autoApplyMode, autoApplyRecordVideo, autoApplyHeadless, autoApplyAutoSubmit)
  VALUES (1, 'test', 1, 0, 0);
`)

console.log('✅ Settings table created with defaults:\n')
console.log('  Auto-apply mode: TEST (analyze only)')
console.log('  Video recording: ENABLED')
console.log('  Headless mode: DISABLED (show browser)')
console.log('  Auto-submit: DISABLED (manual review)\n')

db.close()
