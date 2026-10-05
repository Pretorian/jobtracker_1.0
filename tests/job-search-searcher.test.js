import { describe, it, expect, beforeEach } from 'vitest'
import { searchJobs } from '../server/job-search/searcher.js'

describe('job-search/searcher.js', () => {
  beforeEach(() => {
    globalThis.__playwrightFormResponse = null
  })

  it('runs all boards by default and aggregates jobs', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'Eng', company: 'A', location: 'Remote', url: 'https://x.com/1', source: 'LinkedIn', postedDate: '2026-05-15' },
    ]
    const jobs = await searchJobs({ keywords: 'engineer' })
    expect(Array.isArray(jobs)).toBe(true)
  })

  it('accepts a custom board subset', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'Eng', company: 'A', location: 'Remote', url: 'https://x.com/1', source: 'LinkedIn' },
    ]
    const jobs = await searchJobs({ keywords: 'engineer', boards: ['linkedin'] })
    expect(jobs.length).toBeGreaterThanOrEqual(1)
  })

  it('passes experience and date filters via URL', async () => {
    globalThis.__playwrightFormResponse = []
    const jobs = await searchJobs({
      keywords: 'engineer',
      boards: ['linkedin'],
      experienceLevel: 'senior',
      jobType: 'contract',
      postedWithin: 30,
    })
    expect(jobs).toEqual([])
  })

  it('handles unsupported postedWithin gracefully', async () => {
    globalThis.__playwrightFormResponse = []
    const jobs = await searchJobs({
      keywords: 'engineer',
      boards: ['linkedin'],
      postedWithin: 99,
    })
    expect(jobs).toEqual([])
  })

  it('searches Indeed with filtered URLs', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'X', company: 'Y', location: 'Remote', url: 'https://indeed.com/viewjob?jk=abc', source: 'Indeed' },
      { title: 'NoUrl', company: 'Y', location: 'Remote', url: null, source: 'Indeed' },
    ]
    const jobs = await searchJobs({ keywords: 'eng', boards: ['indeed'] })
    expect(jobs.every(j => j.url)).toBe(true)
  })

  it('searches Google Jobs', async () => {
    globalThis.__playwrightFormResponse = [
      { title: 'Eng', company: 'A', location: 'Remote', url: null, source: 'Google Jobs' },
    ]
    const jobs = await searchJobs({ keywords: 'eng', boards: ['google'] })
    expect(jobs.length).toBeGreaterThanOrEqual(1)
  })

  it('warns on unknown boards but keeps going', async () => {
    globalThis.__playwrightFormResponse = []
    const jobs = await searchJobs({ keywords: 'eng', boards: ['unknown-board', 'linkedin'] })
    expect(Array.isArray(jobs)).toBe(true)
  })

  it('continues when one board throws', async () => {
    globalThis.__playwrightGotoBehavior = () => {
      throw new Error('network error')
    }
    const jobs = await searchJobs({ keywords: 'eng', boards: ['linkedin'] })
    expect(jobs).toEqual([])
    globalThis.__playwrightGotoBehavior = null
  })
})
