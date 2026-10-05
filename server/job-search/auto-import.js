const { searchJobs } = require('./searcher')
const { scrapeJobUrl } = require('../scraper/scraper')
const { parseWithClaude } = require('../scraper/parser')
const { createJob } = require('../db/database')
const Anthropic = require('@anthropic-ai/sdk')

/**
 * Automated job search and import with AI evaluation
 */

async function autoSearchAndImport(criteria) {
  const {
    keywords,
    location,
    experienceLevel,
    jobType,
    postedWithin,
    limit,
    boards,
    threshold = 70, // Minimum fit score to auto-import
    autoImport = true, // Whether to auto-import or just return matches
  } = criteria

  console.log(`\n🤖 Starting automated job search...`)
  console.log(`  Threshold: ${threshold}% fit score`)
  console.log(`  Auto-import: ${autoImport ? 'Yes' : 'No (preview only)'}`)

  // Step 1: Search job boards
  const jobs = await searchJobs({
    keywords,
    location,
    experienceLevel,
    jobType,
    postedWithin,
    limit,
    boards
  })

  if (jobs.length === 0) {
    console.log(`\n⚠️  No jobs found matching criteria`)
    return {
      searched: 0,
      evaluated: 0,
      imported: 0,
      skipped: 0,
      results: []
    }
  }

  // Step 2: Evaluate each job with AI
  console.log(`\n🤖 Evaluating ${jobs.length} jobs with AI...`)

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const results = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    console.log(`\n[${i + 1}/${jobs.length}] Evaluating: ${job.title} at ${job.company}`)

    try {
      // Step 2a: Scrape full job description if URL available
      let jobDescription = ''
      if (job.url) {
        try {
          console.log(`  🌐 Scraping job details from ${job.url}`)
          const scraped = await scrapeJobUrl(job.url)
          jobDescription = scraped.content
          console.log(`  ✅ Scraped ${jobDescription.length} characters`)
        } catch (scrapeError) {
          console.log(`  ⚠️  Scraping failed: ${scrapeError.message}`)
          // Continue with basic info
          jobDescription = `${job.title} at ${job.company}\nLocation: ${job.location}`
        }
      } else {
        jobDescription = `${job.title} at ${job.company}\nLocation: ${job.location}`
      }

      // Step 2b: Parse and evaluate with AI
      console.log(`  🤖 Analyzing fit score...`)
      const parsed = await parseWithClaude(jobDescription, job.url)

      console.log(`  📊 Fit Score: ${parsed.fitScore}%`)

      const result = {
        ...job,
        ...parsed,
        meetsThreshold: parsed.fitScore >= threshold,
        description: jobDescription, // Full job description
        roleSummary: parsed.roleSummary || parsed.summary || 'No summary available'
      }

      results.push(result)

      // Step 3: Auto-import if meets threshold
      if (autoImport && result.meetsThreshold) {
        try {
          console.log(`  ✅ IMPORTING (${parsed.fitScore}% >= ${threshold}%)`)

          const created = createJob({
            company: parsed.company || job.company,
            title: parsed.title || job.title,
            location: parsed.location || job.location,
            type: parsed.type,
            salary: parsed.salary,
            summary: parsed.roleSummary,
            fitScore: parsed.fitScore,
            fitReason: parsed.fitReason,
            url: job.url,
            keySkills: parsed.keySkills || [],
            notes: `Auto-imported from ${job.source} on ${new Date().toLocaleDateString()}\n\nSearch criteria: ${keywords}`
          })

          console.log(`  💾 Imported as Job #${created.id}`)
          imported++
        } catch (importError) {
          console.error(`  ❌ Import failed:`, importError.message)
          result.importError = importError.message
        }
      } else if (result.meetsThreshold) {
        console.log(`  ✓ Matches threshold (${parsed.fitScore}% >= ${threshold}%) - Preview mode, not importing`)
      } else {
        console.log(`  ⊘ Below threshold (${parsed.fitScore}% < ${threshold}%) - Skipping`)
        skipped++
      }

      // Small delay to avoid rate limiting
      if (i < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error) {
      console.error(`  ❌ Evaluation failed:`, error.message)
      results.push({
        ...job,
        error: error.message,
        meetsThreshold: false
      })
      skipped++
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════════════════════════`)
  console.log(`✅ AUTO SEARCH COMPLETE`)
  console.log(`═══════════════════════════════════════════════════════════════════════════════`)
  console.log(`  📊 Searched: ${jobs.length} jobs`)
  console.log(`  🤖 Evaluated: ${results.length} jobs`)
  console.log(`  ✅ Imported: ${imported} jobs`)
  console.log(`  ⊘ Skipped: ${skipped} jobs (below threshold)`)
  console.log(`  🎯 Success rate: ${imported > 0 ? ((imported / jobs.length) * 100).toFixed(1) : 0}%`)
  console.log(`═══════════════════════════════════════════════════════════════════════════════\n`)

  return {
    searched: jobs.length,
    evaluated: results.length,
    imported,
    skipped,
    threshold,
    results: results.map(r => ({
      title: r.title,
      company: r.company,
      location: r.location,
      url: r.url,
      source: r.source,
      fitScore: r.fitScore,
      fitReason: r.fitReason,
      meetsThreshold: r.meetsThreshold,
      imported: autoImport && r.meetsThreshold && !r.importError,
      error: r.error || r.importError,
      // Full details for manual selection
      description: r.description,
      roleSummary: r.roleSummary,
      keySkills: r.keySkills || [],
      type: r.type,
      salary: r.salary
    }))
  }
}

module.exports = { autoSearchAndImport }
