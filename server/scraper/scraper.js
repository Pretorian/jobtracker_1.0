const { chromium } = require('playwright')

/**
 * Scrape job content from a URL using Playwright
 * @param {string} url - The job posting URL
 * @returns {Promise<string>} - The extracted job description text
 */
async function scrapeJobUrl(url) {
  console.log(`\n🌐 Starting Playwright scraper for: ${url}`)
  const startTime = Date.now()

  let browser
  try {
    console.log('  🚀 Launching headless browser...')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    const page = await context.newPage()

    // Navigate to the page with timeout
    console.log('  📄 Navigating to page...')
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    console.log('  ✅ Page loaded successfully')

    // Wait a bit for any dynamic content to load
    console.log('  ⏳ Waiting for dynamic content...')
    await page.waitForTimeout(2000)

    // Try multiple selectors to find job content
    let content = ''
    let matchedSelector = null

    // Common job posting selectors
    const selectors = [
      'main',
      'article',
      '[role="main"]',
      '.job-description',
      '.job-details',
      '#job-description',
      '#job-details',
      '.description',
      '.posting-description',
      'body'
    ]

    console.log('  🔍 Searching for job content...')
    for (const selector of selectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          const text = await element.innerText()
          if (text && text.length > content.length) {
            content = text
            matchedSelector = selector
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!content) {
      throw new Error('Could not extract job content from page')
    }

    console.log(`  ✅ Content extracted using selector: "${matchedSelector}"`)
    console.log(`  📊 Content length: ${content.length} characters`)

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .trim()

    const elapsed = Date.now() - startTime
    console.log(`  ✅ Scraping completed in ${elapsed}ms\n`)

    return content
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`  ❌ Scraping failed after ${elapsed}ms:`, error.message)

    if (error.message?.includes('timeout')) {
      console.error('  💡 The page took too long to load. Try pasting the job description directly.')
    } else if (error.message?.includes('net::')) {
      console.error('  💡 Network error. Check your internet connection or try a different URL.')
    }

    throw new Error(`Failed to scrape URL: ${error.message}`)
  } finally {
    if (browser) {
      await browser.close()
      console.log('  🔒 Browser closed')
    }
  }
}

module.exports = { scrapeJobUrl }
