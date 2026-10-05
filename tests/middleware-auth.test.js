import { describe, it, expect, vi } from 'vitest'
const { requireAuth } = require('../server/middleware/auth')

describe('requireAuth middleware', () => {
  it('returns 401 when no session', () => {
    const req = {}
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when session has no userId', () => {
    const req = { session: {} }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when session has userId', () => {
    const req = { session: { userId: 1 } }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
