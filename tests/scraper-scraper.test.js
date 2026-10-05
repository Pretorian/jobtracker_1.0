import { describe, it, expect, beforeEach } from 'vitest'
import { scrapeJobUrl } from '../server/scraper/scraper.js'

describe('scraper/scraper.js', () => {
  beforeEach(() => {
    globalThis.__playwrightInnerText = 'Sample job description text'
    globalThis.__playwrightGotoBehavior = null
    globalThis.__playwrightLaunchBehavior = null
  })

  it('returns content from selector with longest text', async () => {
    const result = await scrapeJobUrl('https://example.com/job')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles timeout errors', async () => {
    globalThis.__playwrightGotoBehavior = () => {
      const e = new Error('Navigation timeout exceeded')
      throw e
    }
    await expect(scrapeJobUrl('https://example.com/job')).rejects.toThrow(/Failed to scrape URL/)
  })

  it('handles network errors', async () => {
    globalThis.__playwrightGotoBehavior = () => {
      throw new Error('net::ERR_NAME_NOT_RESOLVED')
    }
    await expect(scrapeJobUrl('https://example.com/job')).rejects.toThrow(/Failed to scrape URL/)
  })

  it('throws if no content can be extracted', async () => {
    globalThis.__playwrightInnerText = ''
    await expect(scrapeJobUrl('https://example.com/job')).rejects.toThrow(/Failed to scrape URL/)
  })
})
