/*!
 * JobTracker — telemetry routes (opt-in only)
 * Copyright (c) 2026 AM <andres@lapa.io>
 *
 * Consent endpoints are public so a first-run banner can read/set the choice
 * before login. Event ingestion is a no-op unless consent === 'granted'. The
 * owner-only summary sits behind auth. See PRIVACY.md.
 */

const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const telemetry = require('../db/telemetry')
const { requireAuth } = require('../middleware/auth')

const validateInput = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() })
  }
  next()
}

// GET /api/telemetry/consent - current consent state (for the first-run banner)
router.get('/consent', (req, res) => {
  res.json({ consent: telemetry.getConsent() })
})

// POST /api/telemetry/consent - set consent. { state: 'granted' | 'denied' }
router.post('/consent',
  [body('state').isIn(['granted', 'denied']).withMessage("state must be 'granted' or 'denied'")],
  validateInput,
  (req, res) => {
    try {
      const state = telemetry.setConsent(req.body.state)
      console.log(`📈 Telemetry consent set to: ${state}`)
      res.json({ success: true, consent: state })
    } catch (error) {
      console.error('Telemetry consent error:', error)
      res.status(500).json({ error: 'Failed to set consent' })
    }
  }
)

// POST /api/telemetry/event - record a usage event (dropped unless opted in)
router.post('/event',
  [body('name').isString().trim().notEmpty().withMessage('name is required')],
  validateInput,
  (req, res) => {
    const recorded = telemetry.recordEvent(req.body.name, req.body.props || {})
    // Always 200 so the client never has to care; `recorded` tells the truth.
    res.json({ success: true, recorded })
  }
)

// GET /api/telemetry/summary - owner-only aggregate view (no raw user data)
router.get('/summary', requireAuth, (req, res) => {
  res.json(telemetry.getSummary())
})

module.exports = router
