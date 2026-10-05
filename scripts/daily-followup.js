#!/usr/bin/env node

/**
 * Daily Follow-up Notification Script
 * Run this script daily (e.g., via cron or Task Scheduler) to get notifications
 * about jobs that need follow-up.
 *
 * Usage:
 *   node scripts/daily-followup.js
 *
 * To schedule daily (Unix/Mac - add to crontab):
 *   0 9 * * * cd /path/to/job-tracker && node scripts/daily-followup.js
 *
 * To schedule daily (Windows - add to Task Scheduler):
 *   Action: Start a program
 *   Program: node
 *   Arguments: C:\path\to\job-tracker\scripts\daily-followup.js
 *   Start in: C:\path\to\job-tracker
 */

const path = require('path')
const { getJobsNeedingFollowUp } = require('../server/db/database')

function sendNotification(jobs) {
  if (jobs.length === 0) {
    console.log('✅ No follow-ups needed today!')
    return
  }

  console.log('\n' + '='.repeat(70))
  console.log(`⚡ FOLLOW-UP REMINDER - ${new Date().toLocaleDateString()}`)
  console.log('='.repeat(70))
  console.log(`\nYou have ${jobs.length} job${jobs.length > 1 ? 's' : ''} that need follow-up:\n`)

  jobs.forEach((job, index) => {
    const daysAgo = Math.floor(
      (Date.now() - new Date(job.appliedDate).getTime()) / 86400000
    )

    console.log(`${index + 1}. ${job.title} at ${job.company}`)
    console.log(`   Status: ${job.status.toUpperCase()}`)
    console.log(`   Applied: ${job.appliedDate} (${daysAgo} days ago)`)
    if (job.url) {
      console.log(`   URL: ${job.url}`)
    }
    console.log('')
  })

  console.log('=' .repeat(70))
  console.log('💡 TIP: Update "Last Contact" date after following up')
  console.log('=' .repeat(70) + '\n')

  // Optional: Send email notification
  // You can integrate with services like SendGrid, Mailgun, or nodemailer
  // sendEmailNotification(jobs)

  // Optional: Send desktop notification (Mac/Linux)
  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      const { exec } = require('child_process')
      const title = 'Job Follow-up Reminder'
      const message = `${jobs.length} job${jobs.length > 1 ? 's' : ''} need follow-up`

      if (process.platform === 'darwin') {
        // macOS notification
        exec(`osascript -e 'display notification "${message}" with title "${title}"'`)
      } else if (process.platform === 'linux') {
        // Linux notification (requires notify-send)
        exec(`notify-send "${title}" "${message}"`)
      }
    } catch (e) {
      // Desktop notifications are optional, don't fail if they don't work
    }
  }
}

// Optional: Email notification function
// Uncomment and configure to enable email notifications
/*
async function sendEmailNotification(jobs) {
  // Example using a generic SMTP setup
  // You'll need to install nodemailer: npm install nodemailer
  const nodemailer = require('nodemailer')

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  const jobList = jobs.map((job, index) => {
    const daysAgo = Math.floor(
      (Date.now() - new Date(job.appliedDate).getTime()) / 86400000
    )
    return `${index + 1}. ${job.title} at ${job.company} (${daysAgo} days ago)`
  }).join('\n')

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `⚡ Job Follow-up Reminder - ${jobs.length} job${jobs.length > 1 ? 's' : ''}`,
    text: `You have ${jobs.length} job${jobs.length > 1 ? 's' : ''} that need follow-up:\n\n${jobList}`,
  })

  console.log('✉️  Email notification sent!')
}
*/

// Main execution
try {
  const jobs = getJobsNeedingFollowUp()
  sendNotification(jobs)
} catch (error) {
  console.error('❌ Error running follow-up script:', error.message)
  process.exit(1)
}
