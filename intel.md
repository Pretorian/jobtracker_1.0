# JobTracker — Provenance & Telemetry Intel

Owner reference for the authorship watermark and the opt-in usage telemetry
added to JobTracker. These are **open** markers and an **opt-in** system — not
hidden payloads. This file is just a convenient index.

Author: AM <andres@lapa.io>

---

## 1. Authorship fingerprints (watermark)

Purpose: prove this code is yours. If these exact values appear in another
codebase, that is evidence of copying. Keep them stable.

Defined in: `server/build-info.js`

| Marker            | Value                          | Notes                                   |
|-------------------|--------------------------------|-----------------------------------------|
| `ORIGIN_ID`       | `jt-7f3a1c9e-origin-2026`      | Unique origin UUID for this codebase    |
| `BUILD_SIGNATURE` | `0x4a545241` (`"JTRA"`)        | Distinctive magic constant, no behavior |
| `AUTHOR`          | `AM <andres@lapa.io>` | Attribution string                      |

Where they surface:
- `server/build-info.js` — source of truth.
- `server/index.js` — prints `signatureLine()` at startup, so every running
  copy logs: `JobTracker · jt-7f3a1c9e-origin-2026 · build 0x4a545241 · © ...`.

Supporting attribution (visible, legally meaningful):
- `NOTICE` — repo root. Retention-required attribution + provenance note.
- Copyright headers (`/*! ... */`) at the top of:
  - `server/index.js`
  - `server/build-info.js`
  - `server/db/telemetry.js`
  - `server/routes/telemetry.js`

To detect copying later: grep a suspect repo for `jt-7f3a1c9e-origin-2026` or
`0x4a545241` / `4a545241`.

> Note: this is a watermark, not DRM. It's deliberately open and greppable —
> its value is being *provable*, not concealed. It does not depend on, and is
> not derived from, any environment variable or secret.

---

## 2. Opt-in usage telemetry

Purpose: see which features get used. **Off by default.** Records nothing
until consent is `granted`. Full policy in `PRIVACY.md`.

Code:
- `server/db/telemetry.js` — store + consent gate (idempotent tables, no
  migration needed).
- `server/routes/telemetry.js` — HTTP endpoints.
- Mounted in `server/index.js` at `/api/telemetry`.

Storage (local, in `data/jobs.db`):
- `telemetry_meta` — `installId`, `consent`.
- `telemetry_events` — `name`, `props`, `appVersion`, `createdAt`.

Endpoints:
| Method | Path                      | Auth  | Purpose                              |
|--------|---------------------------|-------|--------------------------------------|
| GET    | `/api/telemetry/consent`  | none  | Read consent state                   |
| POST   | `/api/telemetry/consent`  | none  | Set `granted` / `denied`             |
| POST   | `/api/telemetry/event`    | none  | Record event (dropped unless opted in) |
| GET    | `/api/telemetry/summary`  | login | Owner aggregate (counts, no raw data) |

Consent states: `unset` (default) → nothing recorded; `granted` → recording;
`denied` → recording off **and** existing events deleted.

### Not yet wired (your call)
- **Frontend consent banner** — a first-run prompt that calls
  `GET/POST /api/telemetry/consent`. Server-side gate works without it, but
  without a UI prompt consent stays `unset` (nothing recorded) until set.
- **Event emission** — add `POST /api/telemetry/event` calls where you care
  (e.g. after creating a job or generating a resume). None are emitted yet.
- **External sink** — everything is local-only. To collect across installs,
  forward events from `recordEvent` to a service (PostHog/Plausible/your own).

### Quick manual test
```
# opt in
curl -X POST localhost:4001/api/telemetry/consent -H 'Content-Type: application/json' -d '{"state":"granted"}'
# send an event
curl -X POST localhost:4001/api/telemetry/event   -H 'Content-Type: application/json' -d '{"name":"test_event"}'
# view summary (needs an authenticated session cookie)
curl localhost:4001/api/telemetry/summary --cookie "<session>"
```
