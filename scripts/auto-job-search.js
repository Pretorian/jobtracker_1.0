#!/usr/bin/env node

/**
 * Automated Job Search Script
 *
 * Run this script manually or schedule it with cron/Task Scheduler
 * to automatically search job boards and import matching jobs.
 *
 * Usage:
 *   node scripts/auto-job-search.js
 *   node scripts/auto-job-search.js --keywords "Senior Engineer" --threshold 80
 *   node scripts/auto-job-search.js --dry-run  # Preview only, don't import
 */

require('dotenv').config()
const { autoSearchAndImport } = require('../server/job-search/auto-import')

// Parse command line arguments
const args = process.argv.slice(2)
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`)
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue
}

const hasFlag = (name) => args.includes(`--${name}`)

const config = {
  keywords: getArg('keywords', process.env.SEARCH_KEYWORDS || 'Software Engineer'),
  location: getArg('location', process.env.SEARCH_LOCATION || 'Remote'),
  experienceLevel: getArg('experience', process.env.SEARCH_EXPERIENCE || 'mid_senior'),
  jobType: getArg('type', process.env.SEARCH_JOB_TYPE || 'full_time'),
  postedWithin: parseInt(getArg('days', process.env.SEARCH_DAYS || '7')),
  limit: parseInt(getArg('limit', process.env.SEARCH_LIMIT || '20')),
  boards: getArg('boards', process.env.SEARCH_BOARDS || 'linkedin,indeed').split(','),
  threshold: parseInt(getArg('threshold', process.env.SEARCH_THRESHOLD || '70')),
  autoImport: !hasFlag('dry-run') && !hasFlag('preview')
}

console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         AUTOMATED JOB SEARCH                                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Configuration:
  Keywords:        ${config.keywords}
  Location:        ${config.location}
  Experience:      ${config.experienceLevel}
  Job Type:        ${config.jobType}
  Posted Within:   ${config.postedWithin} days
  Limit:           ${config.limit} per board
  Job Boards:      ${config.boards.join(', ')}
  Fit Threshold:   ${config.threshold}%
  Auto-Import:     ${config.autoImport ? '✅ ENABLED' : '⊘ DISABLED (Preview mode)'}

`)

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ERROR: ANTHROPIC_API_KEY not set in environment')
  console.error('💡 Add your API key to .env file')
  process.exit(1)
}

// Run the automated search
autoSearchAndImport(config)
  .then(results => {
    console.log(`\n✅ Automated job search completed successfully!\n`)
    process.exit(0)
  })
  .catch(error => {
    console.error(`\n❌ Automated job search failed:`, error)
    process.exit(1)
  })
