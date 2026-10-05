/*!
 * JobTracker — telemetry store (opt-in only)
 * Copyright (c) 2026 AM <andres@lapa.io>
 *
 * Usage visibility for the app owner. NOTHING is recorded unless consent is
 * explicitly granted. See PRIVACY.md for exactly what is and isn't collected.
 */

const crypto = require('crypto')
const { db } = require('./database')

// Idempotent schema — created here so no separate migration is needed, matching
// the gap_analysis_cache pattern in database.js.
db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    props TEXT,
    appVersion TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

// A random, non-identifying install ID. Generated once per database so repeated
// events can be grouped as "one install" without knowing who the user is.
function getInstallId() {
  let row = db.prepare('SELECT value FROM telemetry_meta WHERE key = ?').get('installId')
  if (!row) {
    const id = 'inst-' + crypto.randomBytes(8).toString('hex')
    db.prepare('INSERT INTO telemetry_meta (key, value) VALUES (?, ?)').run('installId', id)
    row = { value: id }
  }
  return row.value
}

// Consent state: 'granted' | 'denied' | 'unset' (the default).
function getConsent() {
  const row = db.prepare('SELECT value FROM telemetry_meta WHERE key = ?').get('consent')
  return row ? row.value : 'unset'
}

function setConsent(state) {
  if (!['granted', 'denied'].includes(state)) {
    throw new Error("consent must be 'granted' or 'denied'")
  }
  db.prepare(`
    INSERT INTO telemetry_meta (key, value) VALUES ('consent', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(state)
  // Honour a withdrawal: drop everything collected so far.
  if (state === 'denied') {
    db.prepare('DELETE FROM telemetry_events').run()
  }
  return state
}

// The consent gate. Returns false (and records nothing) unless consent is
// granted. `props` is coerced to a small JSON string; anything non-trivial is
// dropped to avoid accidentally capturing user content.
function recordEvent(name, props = {}) {
  if (getConsent() !== 'granted') return false
  if (typeof name !== 'string' || !name) return false

  let propsJson = null
  try {
    const safe = {}
    for (const [k, v] of Object.entries(props || {})) {
      if (['string', 'number', 'boolean'].includes(typeof v)) {
        safe[k] = typeof v === 'string' ? v.slice(0, 120) : v
      }
    }
    propsJson = JSON.stringify(safe)
  } catch {
    propsJson = null
  }

  const appVersion = require('../build-info').version
  db.prepare(`
    INSERT INTO telemetry_events (name, props, appVersion) VALUES (?, ?, ?)
  `).run(name.slice(0, 80), propsJson, appVersion)
  return true
}

// Owner-facing summary: counts by event name, plus totals. No raw user data.
function getSummary() {
  const byName = db.prepare(`
    SELECT name, COUNT(*) as count, MAX(createdAt) as lastSeen
    FROM telemetry_events
    GROUP BY name
    ORDER BY count DESC
  `).all()
  const total = db.prepare('SELECT COUNT(*) as count FROM telemetry_events').get().count
  return {
    installId: getInstallId(),
    consent: getConsent(),
    totalEvents: total,
    byName,
  }
}

module.exports = {
  getInstallId,
  getConsent,
  setConsent,
  recordEvent,
  getSummary,
}
