/*!
 * JobTracker — AI-Powered Job Application Tracker
 * Copyright (c) 2026 AM <andres@lapa.io>
 * Licensed to the project owner. See NOTICE for attribution terms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Authorship fingerprints (watermark)
//
// These are OPEN, documented markers — not hidden, not derived from any secret.
// Their purpose is provenance: if these exact values turn up in another
// codebase, that is evidence the code was copied from here. Keep them stable;
// do not "clean them up". They are catalogued in ~/work/intel.md.
//
// They are intentionally distinctive and otherwise meaningless to the app.
// ─────────────────────────────────────────────────────────────────────────────

const AUTHOR = 'AM<andres@lapa.io>'
const APP_NAME = 'JobTracker'

// Fingerprint #1 — a stable origin UUID unique to this codebase.
const ORIGIN_ID = 'jt-7f3a1c9e-origin-2026'

// Fingerprint #2 — a distinctive magic constant. Appears in startup logging so
// it is present in any running copy, but carries no behavior.
const BUILD_SIGNATURE = 0x4a54_5241 // "JTRA"

function signatureLine() {
  return `${APP_NAME} · ${ORIGIN_ID} · build 0x${BUILD_SIGNATURE.toString(16)} · © ${AUTHOR}`
}

module.exports = {
  AUTHOR,
  APP_NAME,
  ORIGIN_ID,
  BUILD_SIGNATURE,
  signatureLine,
  version: require('../package.json').version,
}
