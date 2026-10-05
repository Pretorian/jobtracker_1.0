import { describe, it, expect, beforeEach } from 'vitest'
import { fillApplicationForm } from '../server/auto-apply/form-filler.js'

describe('auto-apply/form-filler.js', () => {
  beforeEach(() => {
    globalThis.__playwrightLocatorOverrides = null
    globalThis.__playwrightGotoBehavior = null
  })

  it('fills a form and returns success without submission', async () => {
    const mapping = { firstName: 'Jane', lastName: 'Smith', email: 'j@example.com' }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      mapping,
      { resume: '/tmp/resume.docx', coverLetter: '/tmp/cl.docx' },
      { headless: true, autoSubmit: false }
    )
    expect(result.success).toBe(true)
    expect(result.submitted).toBe(false)
  })

  it('skips empty values', async () => {
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { firstName: '', lastName: 'X' },
      {},
      { headless: true }
    )
    expect(result.success).toBe(true)
  })

  it('auto-submits when enabled', async () => {
    const mapping = { firstName: 'Jane' }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      mapping,
      {},
      { headless: true, autoSubmit: true }
    )
    expect(result.success).toBe(true)
    expect(result.submitted).toBe(true)
  })

  it('reports when submit button is not found', async () => {
    globalThis.__playwrightLocatorOverrides = {
      count: 0,
      isVisible: false,
    }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { firstName: 'Jane' },
      {},
      { headless: true, autoSubmit: true }
    )
    expect(result.success).toBe(true)
    expect(result.submitted).toBe(false)
  })

  it('handles select dropdowns when tag is select', async () => {
    globalThis.__playwrightLocatorOverrides = {
      evaluate: async (fn) => {
        try {
          return fn({ tagName: 'SELECT' })
        } catch {
          return 'select'
        }
      },
    }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { country: 'US' },
      {},
      { headless: true }
    )
    expect(result.success).toBe(true)
  })

  it('handles checkbox/radio inputs', async () => {
    let evalCallCount = 0
    globalThis.__playwrightLocatorOverrides = {
      evaluate: async (fn) => {
        evalCallCount++
        try {
          // First evaluate is tagName, second is type
          if (evalCallCount % 2 === 1) return fn({ tagName: 'INPUT' })
          return fn({ type: 'checkbox' })
        } catch {
          return evalCallCount % 2 === 1 ? 'input' : 'checkbox'
        }
      },
    }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { agree: 'Yes' },
      {},
      { headless: true }
    )
    expect(result.success).toBe(true)
  })

  it('returns browser handle when not headless and not auto-submitting', async () => {
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { firstName: 'Jane' },
      {},
      { headless: false, autoSubmit: false }
    )
    expect(result.success).toBe(true)
    expect(result.browser).toBeTruthy()
  })

  it('throws when page load fails', async () => {
    globalThis.__playwrightGotoBehavior = () => {
      throw new Error('nav failed')
    }
    await expect(
      fillApplicationForm('https://x.com', { firstName: 'X' }, {}, { headless: true })
    ).rejects.toThrow(/Failed to fill form/)
  })

  it('continues filling when one field selector errors', async () => {
    let calls = 0
    globalThis.__playwrightLocatorOverrides = {
      // Make count throw on first lookup so the inner try catches it
      count: async () => {
        calls++
        if (calls === 1) throw new Error('lookup boom')
        return 1
      },
    }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { firstName: 'Jane' },
      {},
      { headless: true }
    )
    expect(result.success).toBe(true)
  })

  it('handles auto-submit when submit click throws', async () => {
    globalThis.__playwrightLocatorOverrides = {
      count: async () => 1,
      isVisible: async () => true,
      click: () => { throw new Error('submit broke') },
    }
    const result = await fillApplicationForm(
      'https://example.com/apply',
      { firstName: 'Jane' },
      {},
      { headless: true, autoSubmit: true }
    )
    expect(result.success).toBe(true)
  })
})
