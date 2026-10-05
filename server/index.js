// Load environment variables from .env file
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const path = require('path')
const fs = require('fs')
const jobsRouter = require('./routes/jobs')
const resumeRouter = require('./routes/resume')
const searchRouter = require('./routes/search')
const authRouter = require('./routes/auth')
const { requireAuth } = require('./middleware/auth')

const app = express()
const PORT = process.env.PORT || 3000

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70))
console.log('🔍 VALIDATING ENVIRONMENT CONFIGURATION')
console.log('═'.repeat(70))

// Check required environment variables
const requiredEnvVars = {
  'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY,
}

const optionalEnvVars = {
  'NEXT_PUBLIC_API_URL': process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  'PORT': process.env.PORT || '3000',
}

let hasErrors = false

console.log('\n📋 Required Environment Variables:')
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value || value === 'your_api_key_here') {
    console.log(`  ❌ ${key}: NOT SET`)
    hasErrors = true
  } else {
    const maskedValue = value.substring(0, 10) + '...' + value.substring(value.length - 4)
    console.log(`  ✅ ${key}: ${maskedValue}`)
  }
}

console.log('\n📋 Optional Environment Variables:')
for (const [key, value] of Object.entries(optionalEnvVars)) {
  console.log(`  ℹ️  ${key}: ${value}`)
}

// Check database file
const dbPath = path.join(__dirname, '../data/jobs.db')
console.log('\n💾 Database:')
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath)
  console.log(`  ✅ Database found: ${dbPath}`)
  console.log(`  📊 Size: ${(stats.size / 1024).toFixed(2)} KB`)
} else {
  console.log(`  ⚠️  Database not found: ${dbPath}`)
  console.log(`  💡 Run: npm run db:init`)
  hasErrors = true
}

// Check resume template
const templatePath = path.join(__dirname, '../data/master-resume-template.docx')
console.log('\n📄 Resume Template:')
if (fs.existsSync(templatePath)) {
  const stats = fs.statSync(templatePath)
  console.log(`  ✅ Template found: ${templatePath}`)
  console.log(`  📊 Size: ${(stats.size / 1024).toFixed(2)} KB`)
} else {
  console.log(`  ⚠️  Template not found: ${templatePath}`)
  console.log(`  💡 Add your resume template to enable resume generation`)
}

// Check resume output directory
const resumeDir = path.join(__dirname, '../public/resumes')
if (!fs.existsSync(resumeDir)) {
  fs.mkdirSync(resumeDir, { recursive: true })
  console.log(`  ✅ Created resume output directory: ${resumeDir}`)
} else {
  console.log(`  ✅ Resume output directory exists: ${resumeDir}`)
}

console.log('\n' + '═'.repeat(70))

if (hasErrors) {
  console.log('⚠️  WARNING: Some required configurations are missing!')
  console.log('💡 Check .env file and run npm run db:init if needed')
  console.log('═'.repeat(70) + '\n')
} else {
  console.log('✅ All required configurations are valid!')
  console.log('═'.repeat(70) + '\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for local development, enable in production
  crossOriginEmbedderPolicy: false
}))

// Cookie parser
app.use(cookieParser())

// Session configuration
let sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SESSION_SECRET must be set in production')
    process.exit(1)
  }
  // Dev fallback: random per process, so logins reset when the server restarts
  sessionSecret = require('crypto').randomBytes(32).toString('hex')
  console.warn('⚠️  SESSION_SECRET not set; using a random secret (sessions reset on restart)')
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// CORS - restricted to frontend only
const FRONTEND_PORT = process.env.FRONTEND_PORT || 4000
const allowedOrigins = [
  `http://localhost:${FRONTEND_PORT}`,
  `http://127.0.0.1:${FRONTEND_PORT}`,
  process.env.FRONTEND_URL
].filter(Boolean)

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.warn(`⚠️  Blocked CORS request from origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))

// Serve static resume files
app.use('/resumes', express.static(path.join(__dirname, '../public/resumes')))

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict rate limiter for AI-powered endpoints (expensive operations)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 AI requests per windowMs
  message: { error: 'Too many AI requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Very strict limiter for bulk operations
const bulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 bulk operations per hour
  message: { error: 'Too many bulk operations, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter)

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Public routes (no authentication required)
app.use('/api/auth', authRouter)

// Health check endpoint - minimal information disclosure (public)
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
  }

  res.json(health)
})

// Protected routes (authentication required)
app.use('/api/jobs', requireAuth, jobsRouter)
app.use('/api/resume', requireAuth, resumeRouter)
app.use('/api/search', requireAuth, searchRouter)

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  const FRONTEND_PORT = process.env.FRONTEND_PORT || 4000;
  console.log('🚀 SERVER STARTED')
  console.log('═'.repeat(70))
  console.log(`  API Server:    http://localhost:${PORT}`)
  console.log(`  Health Check:  http://localhost:${PORT}/api/health`)
  console.log(`  Frontend:      http://localhost:${FRONTEND_PORT} (if running)`)
  console.log('═'.repeat(70))
  console.log('📡 API Endpoints:')
  console.log(`  GET    /api/jobs                - List all jobs`)
  console.log(`  POST   /api/jobs                - Create job`)
  console.log(`  POST   /api/jobs/parse          - Parse job URL/text`)
  console.log(`  GET    /api/jobs/:id            - Get job details`)
  console.log(`  PUT    /api/jobs/:id            - Update job`)
  console.log(`  DELETE /api/jobs/:id            - Delete job`)
  console.log(`  POST   /api/jobs/:id/resume     - Generate resume`)
  console.log(`  GET    /api/resume/template     - Get template info`)
  console.log(`  GET    /api/resume/template/download - Download template`)
  console.log(`  POST   /api/resume/template/upload   - Upload template`)
  console.log(`  DELETE /api/resume/template     - Delete template`)
  console.log('═'.repeat(70) + '\n')
})

// Fail loudly but cleanly instead of throwing an unhandled 'error' event
// (which looks like "the app won't start" / "nodemon app crashed").
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n' + '═'.repeat(70))
    console.error(`❌ Port ${PORT} is already in use — the API server can't start.`)
    console.error(`   Another process is still holding it (often a previous dev run).`)
    console.error(`   Free it with:  lsof -ti:${PORT} | xargs kill -9`)
    console.error(`   Or run on a different port:  PORT=4002 npm run dev`)
    console.error('═'.repeat(70) + '\n')
  } else {
    console.error('❌ Server failed to start:', err)
  }
  process.exit(1)
})
