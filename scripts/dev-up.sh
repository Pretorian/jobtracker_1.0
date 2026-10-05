#!/usr/bin/env bash
#
# One-command dev startup with preflight checks and health verification.
# Usage: npm run up
#
set -euo pipefail
cd "$(dirname "$0")/.."

FRONTEND_PORT=4000
BACKEND_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || true)
BACKEND_PORT=${BACKEND_PORT:-4001}
LOG_FILE="/tmp/job-tracker-dev.log"

GREEN='\033[32m'; RED='\033[31m'; YELLOW='\033[33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠️  $1${RESET}"; }
fail() { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }

echo "── Preflight ──────────────────────────────────────"

# Node available
command -v node >/dev/null || fail "Node.js is not installed"
ok "Node $(node --version)"

# .env present (server exits without it)
if [ ! -f .env ]; then
  cp .env.example .env
  fail "No .env found — created one from .env.example. Set ANTHROPIC_API_KEY and PORT=4001, then rerun."
fi
grep -qE '^ANTHROPIC_API_KEY=.+' .env && ! grep -q 'your-api-key-here' .env \
  || fail "ANTHROPIC_API_KEY is not set in .env"
# Session secret: generate one on first run so logins survive restarts
if ! grep -qE '^SESSION_SECRET=.+' .env; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if grep -qE '^SESSION_SECRET=' .env; then
    sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$SECRET/" .env && rm -f .env.bak
  else
    echo "SESSION_SECRET=$SECRET" >> .env
  fi
  warn "Generated SESSION_SECRET in .env"
fi
ok ".env configured"

# Dependencies — install if missing or lockfile changed since last install
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  warn "Dependencies missing or stale — running npm install..."
  npm install
fi
ok "Dependencies up to date"

# Database — initialize on first run
if [ ! -f data/jobs.db ]; then
  warn "No database found — running db:init..."
  npm run db:init
  npm run db:auth   # creates the admin user and prints its password once
fi
ok "Database present"

# a11y assets referenced by the UI
[ -d public/a11y ] || npm run a11y:sync
ok "Static assets present"

# Free the ports (also handles zombie processes from a previous crash)
lsof -ti:"$FRONTEND_PORT","$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
ok "Ports $FRONTEND_PORT/$BACKEND_PORT free"

echo "── Starting servers (log: $LOG_FILE) ──────────────"

npx concurrently -k --names next,api \
  "next dev -p $FRONTEND_PORT" \
  "nodemon server/index.js" \
  > "$LOG_FILE" 2>&1 &
DEV_PID=$!
trap 'kill "$DEV_PID" 2>/dev/null || true' EXIT INT TERM

# Wait until BOTH endpoints answer, or bail with the log
wait_for() { # url name timeout_seconds
  for _ in $(seq 1 "$3"); do
    kill -0 "$DEV_PID" 2>/dev/null || { tail -30 "$LOG_FILE"; fail "$2 process died during startup — see log above"; }
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$1")" = "200" ] && { ok "$2 ready"; return 0; }
    sleep 1
  done
  tail -30 "$LOG_FILE"
  fail "$2 did not become healthy within $3s — see log above"
}
wait_for "http://localhost:$BACKEND_PORT/api/health" "API server (:$BACKEND_PORT)" 60
wait_for "http://localhost:$FRONTEND_PORT"           "Frontend (:$FRONTEND_PORT)" 90

echo "───────────────────────────────────────────────────"
ok "App is up: http://localhost:$FRONTEND_PORT"
command -v open >/dev/null && open "http://localhost:$FRONTEND_PORT"
echo "   Tailing logs — Ctrl+C stops both servers."
echo "───────────────────────────────────────────────────"

tail -f "$LOG_FILE" &
TAIL_PID=$!
trap 'kill "$DEV_PID" "$TAIL_PID" 2>/dev/null || true' EXIT INT TERM
wait "$DEV_PID"
