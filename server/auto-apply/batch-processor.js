const { autoApplyToJob, getDefaultUserData } = require('./auto-applier')
const { getJobById, updateJob } = require('../db/database')

/**
 * Process multiple jobs for auto-apply in the background
 */
async function batchAutoApply(jobIds, options = {}) {
  const {
    autoSubmit = false,
    headless = true, // Default to headless for batch processing
    delayBetweenJobs = 5000, // 5 second delay between jobs
    userData = getDefaultUserData()
  } = options

  console.log(`\n🔄 BATCH AUTO-APPLY STARTING`)
  console.log(`══════════════════════════════════════════════════════════════`)
  console.log(`  Jobs to process: ${jobIds.length}`)
  console.log(`  Auto-submit: ${autoSubmit ? '⚠️  ENABLED' : 'Disabled'}`)
  console.log(`  Mode: ${headless ? 'Background (headless)' : 'Visible'}`)
  console.log(`══════════════════════════════════════════════════════════════\n`)

  const results = {
    total: jobIds.length,
    processed: 0,
    successful: 0,
    submitted: 0,
    failed: 0,
    jobs: []
  }

  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i]
    console.log(`\n[${i + 1}/${jobIds.length}] Processing job #${jobId}...`)

    try {
      const job = getJobById(jobId)
      if (!job) {
        console.error(`  ❌ Job #${jobId} not found`)
        results.jobs.push({
          jobId,
          success: false,
          error: 'Job not found'
        })
        results.failed++
        continue
      }

      if (!job.url) {
        console.error(`  ❌ Job #${jobId} has no URL`)
        results.jobs.push({
          jobId,
          job: { id: job.id, title: job.title, company: job.company },
          success: false,
          error: 'No URL available'
        })
        results.failed++
        continue
      }

      // Run auto-apply
      const result = await autoApplyToJob(job, userData, {
        autoSubmit,
        headless,
        dryRun: false
      })

      results.processed++

      if (result.success) {
        results.successful++
        if (result.submitted) {
          results.submitted++

          // Update job status to applied if submitted
          try {
            updateJob(jobId, {
              status: 'applied',
              appliedDate: new Date().toISOString().split('T')[0],
              notes: (job.notes || '') + `\n\nAuto-applied via batch process on ${new Date().toLocaleString()}`
            })
            console.log(`  ✅ Job status updated to "applied"`)
          } catch (updateError) {
            console.error(`  ⚠️  Could not update job status:`, updateError.message)
          }
        }

        results.jobs.push({
          jobId,
          job: { id: job.id, title: job.title, company: job.company },
          success: true,
          submitted: result.submitted,
          files: result.files
        })

        console.log(`  ✅ Job #${jobId} completed ${result.submitted ? 'and submitted' : '(not submitted)'}`)
      } else {
        results.failed++
        results.jobs.push({
          jobId,
          job: { id: job.id, title: job.title, company: job.company },
          success: false,
          error: result.error
        })
        console.log(`  ❌ Job #${jobId} failed: ${result.error}`)
      }

      // Delay before next job (except for last one)
      if (i < jobIds.length - 1 && delayBetweenJobs > 0) {
        console.log(`  ⏳ Waiting ${delayBetweenJobs / 1000}s before next job...`)
        await new Promise(resolve => setTimeout(resolve, delayBetweenJobs))
      }

    } catch (error) {
      console.error(`  ❌ Error processing job #${jobId}:`, error.message)
      results.failed++
      results.jobs.push({
        jobId,
        success: false,
        error: error.message
      })
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════════`)
  console.log(`✅ BATCH AUTO-APPLY COMPLETE`)
  console.log(`══════════════════════════════════════════════════════════════`)
  console.log(`  Total jobs: ${results.total}`)
  console.log(`  Processed: ${results.processed}`)
  console.log(`  Successful: ${results.successful}`)
  console.log(`  Submitted: ${results.submitted}`)
  console.log(`  Failed: ${results.failed}`)
  console.log(`══════════════════════════════════════════════════════════════\n`)

  return results
}

module.exports = {
  batchAutoApply
}
