#!/usr/bin/env node

/**
 * Health Check Script
 * Verifies all components of the Job Tracker are running properly
 */

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const FRONTEND_PORT = process.env.FRONTEND_PORT || 4000
const BACKEND_PORT = process.env.PORT || 3000
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`
const DB_PATH = path.join(__dirname, '../data/jobs.db')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function checkUrl(url, name) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http

    protocol.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log(`${colors.green}✅ ${name}${colors.reset} - Running (HTTP ${res.statusCode})`)
        resolve(true)
      } else {
        console.log(`${colors.yellow}⚠️  ${name}${colors.reset} - Unexpected status: ${res.statusCode}`)
        resolve(false)
      }
    }).on('error', (err) => {
      console.log(`${colors.red}❌ ${name}${colors.reset} - Not running (${err.message})`)
      resolve(false)
    })
  })
}

function checkFile(filePath, name) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath)
    const sizeMB = (stats.size / 1024).toFixed(2)
    console.log(`${colors.green}✅ ${name}${colors.reset} - Found (${sizeMB} KB)`)
    return true
  } else {
    console.log(`${colors.red}❌ ${name}${colors.reset} - Not found`)
    return false
  }
}

async function checkAPIEndpoints() {
  const endpoints = [
    { url: `${BACKEND_URL}/api/health`, name: 'Health Check' },
    { url: `${BACKEND_URL}/api/settings`, name: 'Settings API' },
    { url: `${BACKEND_URL}/api/jobs`, name: 'Jobs API' }
  ]

  console.log(`\n${colors.cyan}📡 Checking API Endpoints:${colors.reset}`)

  for (const endpoint of endpoints) {
    await checkUrl(endpoint.url, `  ${endpoint.name}`)
  }
}

async function main() {
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.blue}   JOB TRACKER HEALTH CHECK${colors.reset}`)
  console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}\n`)

  // Check Frontend
  console.log(`${colors.cyan}🌐 Frontend Server:${colors.reset}`)
  const frontendOk = await checkUrl(FRONTEND_URL, '  Next.js Dev Server')

  // Check Backend
  console.log(`\n${colors.cyan}🔧 Backend Server:${colors.reset}`)
  const backendOk = await checkUrl(`${BACKEND_URL}/api/health`, '  Express API Server')

  // Check API Endpoints
  if (backendOk) {
    await checkAPIEndpoints()
  }

  // Check Database
  console.log(`\n${colors.cyan}💾 Database:${colors.reset}`)
  const dbOk = checkFile(DB_PATH, '  SQLite Database')

  // Check Resume Template
  console.log(`\n${colors.cyan}📄 Optional Files:${colors.reset}`)
  const templatePath = path.join(__dirname, '../data/master-resume-template.docx')
  checkFile(templatePath, '  Resume Template')

  // Check Recordings Directory
  const recordingsPath = path.join(__dirname, '../public/recordings')
  if (fs.existsSync(recordingsPath)) {
    console.log(`${colors.green}✅ Video Recordings Directory${colors.reset} - Found`)
  } else {
    console.log(`${colors.yellow}⚠️  Video Recordings Directory${colors.reset} - Not found (will be created when needed)`)
  }

  // Summary
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.cyan}📊 Summary:${colors.reset}\n`)

  const allOk = frontendOk && backendOk && dbOk

  if (allOk) {
    console.log(`${colors.green}✨ All critical systems are operational!${colors.reset}\n`)
    console.log(`${colors.cyan}🚀 Access the app:${colors.reset}`)
    console.log(`   Frontend: ${colors.blue}${FRONTEND_URL}${colors.reset}`)
    console.log(`   Backend:  ${colors.blue}${BACKEND_URL}/api/health${colors.reset}`)
  } else {
    console.log(`${colors.red}⚠️  Some systems are not running${colors.reset}\n`)
    console.log(`${colors.yellow}💡 To start the app, run:${colors.reset}`)
    console.log(`   ${colors.cyan}npm run dev${colors.reset}\n`)
  }

  console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}\n`)

  process.exit(allOk ? 0 : 1)
}

main()
