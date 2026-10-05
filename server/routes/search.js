const express = require('express')
const router = express.Router()
const { autoSearchAndImport } = require('../job-search/auto-import')
const { searchJobs } = require('../job-search/searcher')
const { createJob } = require('../db/database')

// POST /api/search/auto - Automated job search with AI evaluation and auto-import
router.post('/auto', async (req, res) => {
  try {
    const {
      keywords = 'Software Engineer',
      location = 'Remote',
      experienceLevel = 'mid_senior',
      jobType = 'full_time',
      postedWithin = 7,
      limit = 20,
      boards = ['linkedin', 'indeed'],
      threshold = 70,
      autoImport = false // Default to preview mode for safety
    } = req.body

    console.log(`\n📡 Received auto-search request:`, {
      keywords,
      location,
      threshold,
      autoImport: autoImport ? 'ENABLED' : 'PREVIEW ONLY'
    })

    const results = await autoSearchAndImport({
      keywords,
      location,
      experienceLevel,
      jobType,
      postedWithin,
      limit,
      boards,
      threshold,
      autoImport
    })

    res.json(results)
  } catch (error) {
    console.error('Error in auto-search:', error)
    res.status(500).json({
      error: error.message || 'Failed to perform auto-search',
      details: error.stack
    })
  }
})

// POST /api/search/boards - Search job boards (without AI evaluation)
router.post('/boards', async (req, res) => {
  try {
    const {
      keywords = 'Software Engineer',
      location = 'Remote',
      experienceLevel = 'mid_senior',
      jobType = 'full_time',
      postedWithin = 7,
      limit = 20,
      boards = ['linkedin', 'indeed']
    } = req.body

    console.log(`\n📡 Received board search request:`, { keywords, location, boards })

    const jobs = await searchJobs({
      keywords,
      location,
      experienceLevel,
      jobType,
      postedWithin,
      limit,
      boards
    })

    res.json({
      count: jobs.length,
      jobs
    })
  } catch (error) {
    console.error('Error searching job boards:', error)
    res.status(500).json({
      error: error.message || 'Failed to search job boards'
    })
  }
})

// GET /api/search/config - Get default search configuration
router.get('/config', (req, res) => {
  res.json({
    defaults: {
      keywords: 'Software Engineer',
      location: 'Remote',
      experienceLevel: 'mid_senior',
      jobType: 'full_time',
      postedWithin: 7,
      limit: 20,
      boards: ['linkedin', 'indeed'],
      threshold: 70,
      autoImport: false
    },
    options: {
      experienceLevels: [
        { value: 'entry', label: 'Entry Level' },
        { value: 'mid', label: 'Mid Level' },
        { value: 'senior', label: 'Senior' },
        { value: 'mid_senior', label: 'Mid & Senior' },
        { value: 'director', label: 'Director' },
        { value: 'executive', label: 'Executive' }
      ],
      jobTypes: [
        { value: 'full_time', label: 'Full-time' },
        { value: 'part_time', label: 'Part-time' },
        { value: 'contract', label: 'Contract' },
        { value: 'temporary', label: 'Temporary' },
        { value: 'internship', label: 'Internship' }
      ],
      boards: [
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'indeed', label: 'Indeed' },
        { value: 'google', label: 'Google Jobs' }
      ],
      postedWithinOptions: [
        { value: 1, label: 'Past 24 hours' },
        { value: 7, label: 'Past week' },
        { value: 30, label: 'Past month' }
      ]
    }
  })
})

// POST /api/search/import - Manually import selected jobs
router.post('/import', async (req, res) => {
  try {
    const { jobs } = req.body

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'No jobs provided for import' })
    }

    console.log(`\n📥 Importing ${jobs.length} manually selected jobs...`)

    const imported = []
    const failed = []

    for (const job of jobs) {
      try {
        const created = createJob({
          company: job.company,
          title: job.title,
          location: job.location,
          type: job.type,
          salary: job.salary,
          summary: job.roleSummary,
          fitScore: job.fitScore,
          fitReason: job.fitReason,
          url: job.url,
          keySkills: job.keySkills || [],
          notes: `Manually imported from ${job.source} via Auto Search\n\nFit Reason: ${job.fitReason || 'N/A'}`
        })

        console.log(`  ✅ Imported: ${job.title} at ${job.company} (Job #${created.id})`)
        imported.push(created)
      } catch (error) {
        console.error(`  ❌ Failed to import: ${job.title} at ${job.company}:`, error.message)
        failed.push({
          job,
          error: error.message
        })
      }
    }

    console.log(`\n✅ Import complete: ${imported.length} imported, ${failed.length} failed\n`)

    res.json({
      success: true,
      imported: imported.length,
      failed: failed.length,
      jobs: imported,
      errors: failed
    })
  } catch (error) {
    console.error('Error importing jobs:', error)
    res.status(500).json({
      error: error.message || 'Failed to import jobs'
    })
  }
})

module.exports = router
