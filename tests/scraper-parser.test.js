import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  const create = async () => {
    const queue = globalThis.__anthropicResponses || []
    if (queue.length > 0) {
      const next = queue.shift()
      if (next instanceof Error) throw next
      return next
    }
    return globalThis.__defaultAnthropicResponse()
  }
  class Anthropic {
    constructor() {
      this.messages = { create }
    }
  }
  function Factory(...args) {
    return new Anthropic(...args)
  }
  Factory.default = Anthropic
  Factory.Anthropic = Anthropic
  return { default: Factory, Anthropic: Factory }
})

import { parseWithClaude } from '../server/scraper/parser.js'

describe('scraper/parser.js', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-1234567890'
    globalThis.__anthropicResponses = []
  })

  it('parses a plain text job description and returns JSON', async () => {
    const result = await parseWithClaude('Senior dev wanted', false)
    expect(result.company).toBe('TestCorp')
    expect(result.fitScore).toBe(80)
  })

  it('parses a URL with isUrl=true', async () => {
    const result = await parseWithClaude('https://example.com/job/1', true)
    expect(result.company).toBeTruthy()
  })

  it('throws when API key missing', async () => {
    const old = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = ''
    await expect(parseWithClaude('text', false)).rejects.toThrow(/ANTHROPIC_API_KEY/)
    process.env.ANTHROPIC_API_KEY = old
  })

  it('throws when API key is the placeholder', async () => {
    const old = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'your_api_key_here'
    await expect(parseWithClaude('text', false)).rejects.toThrow(/ANTHROPIC_API_KEY/)
    process.env.ANTHROPIC_API_KEY = old
  })

  it('handles markdown-wrapped JSON in response', async () => {
    globalThis.__anthropicResponses.push({
      content: [{ type: 'text', text: '```json\n{"company":"X","title":"T","fitScore":50}\n```' }],
    })
    const result = await parseWithClaude('text', false)
    expect(result.company).toBe('X')
  })

  it('handles authentication-style API errors', async () => {
    globalThis.__anthropicResponses.push(new Error('401 authentication failed'))
    await expect(parseWithClaude('text', false)).rejects.toThrow(/Failed to parse with Claude/)
  })

  it('handles non-text content blocks by falling back to empty object', async () => {
    globalThis.__anthropicResponses.push({
      content: [{ type: 'tool_use', text: undefined }],
    })
    const result = await parseWithClaude('text', false)
    expect(result).toEqual({})
  })
})
