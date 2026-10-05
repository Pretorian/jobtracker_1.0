const Database = require('better-sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')
const db = new Database(dbPath)

console.log('🔐 Adding authentication tables...\n')

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

console.log('✅ Users table created')

// Check if default admin user exists
const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin')

if (!existingUser) {
  // Use ADMIN_PASSWORD if provided, otherwise generate a random one and show it once
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url')
  const hashedPassword = bcrypt.hashSync(password, 10)

  db.prepare(`
    INSERT INTO users (username, password)
    VALUES (?, ?)
  `).run('admin', hashedPassword)

  if (process.env.ADMIN_PASSWORD) {
    console.log('✅ Admin user created (username: admin, password from ADMIN_PASSWORD)\n')
  } else {
    console.log('✅ Admin user created')
    console.log(`   Username: admin`)
    console.log(`   Password: ${password}`)
    console.log('⚠️  This password is shown only once. Save it, or change it in Settings after logging in.\n')
  }
} else {
  console.log('ℹ️  Admin user already exists\n')
}

db.close()
console.log('✅ Authentication migration complete!\n')
