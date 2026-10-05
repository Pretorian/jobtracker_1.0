import { describe, it, expect, beforeEach } from 'vitest'
import { analyzeApplicationForm, mapFieldsToData } from '../server/auto-apply/form-analyzer.js'

describe('auto-apply/form-analyzer.js', () => {
  beforeEach(() => {
    globalThis.__playwrightFormResponse = null
  })

  it('analyzes a form and returns fields + uploads', async () => {
    const data = await analyzeApplicationForm('https://example.com/job')
    expect(data.fields.length).toBeGreaterThan(0)
    expect(data.uploads.length).toBeGreaterThan(0)
  })

  it('throws on page errors', async () => {
    globalThis.__playwrightGotoBehavior = () => {
      throw new Error('navigation failed')
    }
    await expect(analyzeApplicationForm('https://x.com/y')).rejects.toThrow(/Failed to analyze form/)
    globalThis.__playwrightGotoBehavior = null
  })

  describe('mapFieldsToData', () => {
    const userData = {
      firstName: 'Jane',
      lastName: 'Smith',
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      phone: '555-1234',
      linkedin: 'linkedin.com/in/jane',
      portfolio: 'jane.dev',
      city: 'SF',
      state: 'CA',
      country: 'US',
      zipCode: '94101',
      address: '1 Main St',
      workAuthorization: 'Yes',
      requiresSponsorship: 'No',
      yearsOfExperience: '10',
      desiredSalary: '$150k',
      startDate: 'June 1',
    }

    function fields(...defs) {
      return defs.map((d, i) => ({ name: `f${i}`, label: d.label || '', type: d.type || 'text', selector: '', required: false, value: '', options: [] }))
    }

    it('maps first/last/full name', () => {
      const m = mapFieldsToData(fields(
        { label: 'first name' },
        { label: 'last name' },
        { label: 'full name' },
      ), userData)
      expect(m.f0).toBe('Jane')
      expect(m.f1).toBe('Smith')
      expect(m.f2).toBe('Jane Smith')
    })

    it('falls back to firstName + lastName for fullName when fullName missing', () => {
      const m = mapFieldsToData(fields({ label: 'full name' }), { firstName: 'A', lastName: 'B' })
      expect(m.f0).toBe('A B')
    })

    it('maps email by label and type=email', () => {
      const m = mapFieldsToData(
        [
          { name: 'a', label: '', type: 'email', selector: '', required: false, value: '', options: [] },
          { name: 'b', label: 'email address', type: 'text', selector: '', required: false, value: '', options: [] },
        ],
        userData
      )
      expect(m.a).toBe('jane@example.com')
      expect(m.b).toBe('jane@example.com')
    })

    it('maps phone, linkedin, portfolio', () => {
      const m = mapFieldsToData(fields(
        { label: 'phone number' },
        { label: 'linkedin url' },
        { label: 'portfolio link' },
      ), userData)
      expect(m.f0).toBe('555-1234')
      expect(m.f1).toBe('linkedin.com/in/jane')
      expect(m.f2).toBe('jane.dev')
    })

    it('maps location fields', () => {
      const m = mapFieldsToData(fields(
        { label: 'city' },
        { label: 'state' },
        { label: 'country' },
        { label: 'zip code' },
        { label: 'street address' },
      ), userData)
      expect(m.f0).toBe('SF')
      expect(m.f1).toBe('CA')
      expect(m.f2).toBe('US')
      expect(m.f3).toBe('94101')
      expect(m.f4).toBe('1 Main St')
    })

    it('maps authorization, sponsorship, experience, salary, start date', () => {
      const m = mapFieldsToData(fields(
        { label: 'are you authorized to work' },
        { label: 'require sponsorship' },
        { label: 'years of experience' },
        { label: 'desired salary' },
        { label: 'available start date' },
      ), userData)
      expect(m.f0).toBe('Yes')
      expect(m.f1).toBe('No')
      expect(m.f2).toBe('10')
      expect(m.f3).toBe('$150k')
      expect(m.f4).toBe('June 1')
    })

    it('uses defaults when userData fields missing', () => {
      const m = mapFieldsToData(fields({ label: 'authorized' }, { label: 'sponsor' }), {})
      expect(m.f0).toBe('Yes')
      expect(m.f1).toBe('No')
    })

    it('skips unknown labels', () => {
      const m = mapFieldsToData(fields({ label: 'favorite color' }), userData)
      expect(m.f0).toBeUndefined()
    })
  })
})
