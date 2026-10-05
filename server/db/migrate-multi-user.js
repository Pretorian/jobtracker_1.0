const Database = require('better-sqlite3')
const path = require('path')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')
const db = new Database(dbPath)

console.log('👥 Migrating to multi-user support...\n')

// Add userId column to jobs table if it doesn't exist
try {
  db.exec(`
    ALTER TABLE jobs ADD COLUMN userId INTEGER REFERENCES users(id)
  `)
  console.log('✅ Added userId column to jobs table')
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('ℹ️  userId column already exists')
  } else {
    throw error
  }
}

// Existing jobs are assigned to the admin user (override with MIGRATE_USERNAME)
const username = process.env.MIGRATE_USERNAME || 'admin'

const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

if (!existingUser) {
  db.close()
  console.error(`❌ User "${username}" not found. Run "npm run db:auth" first.`)
  process.exit(1)
}

const userId = existingUser.id
console.log(`ℹ️  Assigning unowned jobs to "${username}" (ID: ${userId})`)

// Update all existing jobs to belong to that user
const jobsWithoutUser = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE userId IS NULL').get()

if (jobsWithoutUser.count > 0) {
  db.prepare(`
    UPDATE jobs
    SET userId = ?
    WHERE userId IS NULL
  `).run(userId)

  console.log(`✅ Assigned ${jobsWithoutUser.count} existing jobs to user "${username}"`)
} else {
  console.log('ℹ️  No jobs to assign (all jobs already have a user)')
}

// Show summary
const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count
const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE userId = ?').get(userId).count

console.log('\n📊 Summary:')
console.log(`   Total users: ${totalUsers}`)
console.log(`   Jobs for "${username}": ${totalJobs}`)

db.close()
console.log('\n✅ Multi-user migration complete!\n')
