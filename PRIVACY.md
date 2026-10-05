# Privacy & Telemetry

JobTracker can collect **anonymous, opt-in usage telemetry** so the app owner
can see how the app is used. It is **off by default** and collects nothing
until you explicitly grant consent.

## What is collected (only if you opt in)

- A random **install ID** (e.g. `inst-1a2b3c...`). It is generated locally and
  is **not** tied to your name, email, account, or IP.
- **Event names** describing *which* features are used (e.g. `job_created`,
  `resume_generated`).
- A small set of **simple properties** per event (strings/numbers/booleans,
  each string truncated to 120 chars).
- The **app version**.

## What is never collected

- Your identity, username, email, or IP address.
- Job descriptions, resumes, cover letters, notes, or any content you enter.
- API keys, passwords, or anything from your `.env`.

## Consent

- State is one of `unset` (default), `granted`, or `denied`.
- Check it:  `GET  /api/telemetry/consent`
- Set it:    `POST /api/telemetry/consent  { "state": "granted" | "denied" }`
- Setting it to `denied` **deletes all previously recorded events**.

## Your controls

- Nothing is recorded while consent is `unset` or `denied` — the ingestion
  endpoint silently drops events (`recorded: false`).
- Owner-only aggregate view (counts by event, no raw data):
  `GET /api/telemetry/summary` (requires login).

## Where it lives

Events are stored **locally** in the app's SQLite database (`data/jobs.db`,
tables `telemetry_events` / `telemetry_meta`). Nothing leaves your machine
unless you add an external sink yourself.
