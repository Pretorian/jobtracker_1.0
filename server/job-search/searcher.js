const { chromium } = require('playwright')

/**
 * Search job boards programmatically
 * Supports: LinkedIn, Indeed, Google Jobs
 */

async function searchJobs(criteria) {
  const {
    keywords,
    location = 'Remote',
    experienceLevel = 'mid_senior',
    jobType = 'full_time',
    postedWithin = 7, // days
    limit = 20,
    boards = ['linkedin', 'indeed', 'google']
  } = criteria

  console.log(`\n🔍 Starting job search:`)
  console.log(`  Keywords: ${keywords}`)
  console.log(`  Location: ${location}`)
  console.log(`  Experience: ${experienceLevel}`)
  console.log(`  Type: ${jobType}`)
  console.log(`  Posted within: ${postedWithin} days`)
  console.log(`  Boards: ${boards.join(', ')}`)
  console.log(`  Limit: ${limit} per board\n`)

  const allJobs = []

  // Search each board
  for (const board of boards) {
    try {
      console.log(`📋 Searching ${board}...`)
      let jobs = []

      switch (board) {
        case 'linkedin':
          jobs = await searchLinkedIn({ keywords, location, experienceLevel, jobType, postedWithin, limit })
          break
        case 'indeed':
          jobs = await searchIndeed({ keywords, location, jobType, postedWithin, limit })
          break
        case 'google':
          jobs = await searchGoogleJobs({ keywords, location, postedWithin, limit })
          break
        default:
          console.log(`  ⚠️  Unknown board: ${board}`)
      }

      console.log(`  ✅ Found ${jobs.length} jobs on ${board}`)
      allJobs.push(...jobs)
    } catch (error) {
      console.error(`  ❌ Error searching ${board}:`, error.message)
    }
  }

  console.log(`\n✅ Total jobs found: ${allJobs.length}\n`)
  return allJobs
}

async function searchLinkedIn({ keywords, location, experienceLevel, jobType, postedWithin, limit }) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Build LinkedIn search URL
    const experienceLevels = {
      'entry': '1,2',
      'mid': '3',
      'senior': '4',
      'mid_senior': '3,4',
      'director': '5',
      'executive': '6'
    }

    const jobTypes = {
      'full_time': 'F',
      'part_time': 'P',
      'contract': 'C',
      'temporary': 'T',
      'internship': 'I'
    }

    const datePosted = {
      1: 'r86400',
      7: 'r604800',
      30: 'r2592000'
    }

    const expLevel = experienceLevels[experienceLevel] || '3,4'
    const jType = jobTypes[jobType] || 'F'
    const timePosted = datePosted[postedWithin] || 'r604800'

    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_E=${expLevel}&f_JT=${jType}&f_TPR=${timePosted}&sortBy=DD`

    console.log(`  🔗 URL: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Extract job listings
    const jobs = await page.evaluate((maxJobs) => {
      const jobElements = document.querySelectorAll('.base-card')
      const results = []

      for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
        const el = jobElements[i]

        const titleEl = el.querySelector('.base-search-card__title')
        const companyEl = el.querySelector('.base-search-card__subtitle')
        const locationEl = el.querySelector('.job-search-card__location')
        const linkEl = el.querySelector('a.base-card__full-link')

        if (titleEl && companyEl && linkEl) {
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl.textContent.trim(),
            location: locationEl ? locationEl.textContent.trim() : 'Unknown',
            url: linkEl.href.split('?')[0], // Remove tracking params
            source: 'LinkedIn',
            postedDate: new Date().toISOString().split('T')[0]
          })
        }
      }

      return results
    }, limit)

    await browser.close()
    return jobs
  } catch (error) {
    await browser.close()
    throw error
  }
}

async function searchIndeed({ keywords, location, jobType, postedWithin, limit }) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    const jobTypes = {
      'full_time': 'fulltime',
      'part_time': 'parttime',
      'contract': 'contract',
      'temporary': 'temporary',
      'internship': 'internship'
    }

    const jType = jobTypes[jobType] || 'fulltime'
    const searchUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}&jt=${jType}&fromage=${postedWithin}&sort=date`

    console.log(`  🔗 URL: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const jobs = await page.evaluate((maxJobs) => {
      const jobCards = document.querySelectorAll('.job_seen_beacon, .jobsearch-SerpJobCard')
      const results = []

      for (let i = 0; i < Math.min(jobCards.length, maxJobs); i++) {
        const card = jobCards[i]

        const titleEl = card.querySelector('h2.jobTitle a, .jobTitle span')
        const companyEl = card.querySelector('.companyName')
        const locationEl = card.querySelector('.companyLocation')
        const linkEl = card.querySelector('h2.jobTitle a')

        if (titleEl && companyEl) {
          const jobKey = linkEl ? linkEl.getAttribute('data-jk') || linkEl.getAttribute('id') : null
          const url = jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` :
                      linkEl ? `https://www.indeed.com${linkEl.getAttribute('href')}` : null

          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl.textContent.trim(),
            location: locationEl ? locationEl.textContent.trim() : 'Unknown',
            url: url,
            source: 'Indeed',
            postedDate: new Date().toISOString().split('T')[0]
          })
        }
      }

      return results
    }, limit)

    await browser.close()
    return jobs.filter(j => j.url) // Only return jobs with valid URLs
  } catch (error) {
    await browser.close()
    throw error
  }
}

async function searchGoogleJobs({ keywords, location, postedWithin, limit }) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keywords + ' jobs')}&ibp=htl;jobs&l=${encodeURIComponent(location)}`

    console.log(`  🔗 URL: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const jobs = await page.evaluate((maxJobs) => {
      const jobElements = document.querySelectorAll('.PwjeAc, .gws-plugins-horizon-jobs__job-list-item')
      const results = []

      for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
        const el = jobElements[i]

        const titleEl = el.querySelector('.BjJfJf, .sL3Svc')
        const companyEl = el.querySelector('.vNEEBe, .nJlQNd')
        const locationEl = el.querySelector('.Qk80Jf, .sMzDkb')

        if (titleEl && companyEl) {
          // Google Jobs doesn't provide direct links, we'll need to use the search result
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl.textContent.trim(),
            location: locationEl ? locationEl.textContent.trim() : 'Unknown',
            url: null, // Will need to be filled by clicking or secondary search
            source: 'Google Jobs',
            postedDate: new Date().toISOString().split('T')[0]
          })
        }
      }

      return results
    }, limit)

    await browser.close()
    return jobs
  } catch (error) {
    await browser.close()
    throw error
  }
}

module.exports = { searchJobs }
