#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────────────────────────────────
# PowerCouple - One-Command Setup & Launch
#
# Usage:
#   ./setup.sh          # Full setup + launch (first time)
#   ./setup.sh dev      # Just start the dev servers (after first setup)
#   ./setup.sh seed     # Just re-seed the database
#   ./setup.sh reset    # Wipe DB and re-seed
# ──────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

log()  { echo -e "${GREEN}[PowerCouple]${NC} $1"; }
warn() { echo -e "${YELLOW}[PowerCouple]${NC} $1"; }
err()  { echo -e "${RED}[PowerCouple]${NC} $1"; }

# ──────────────────────────────────────────────────────────────────────────
# Check prerequisites
# ──────────────────────────────────────────────────────────────────────────
check_prereqs() {
  local missing=0

  if ! command -v node &>/dev/null; then
    err "Node.js is required but not found. Install from https://nodejs.org"
    missing=1
  else
    log "Node.js $(node -v) found"
  fi

  if ! command -v npm &>/dev/null; then
    err "npm is required but not found."
    missing=1
  else
    log "npm $(npm -v) found"
  fi

  if [ $missing -eq 1 ]; then
    exit 1
  fi
}

# ──────────────────────────────────────────────────────────────────────────
# Install Node.js dependencies
# ──────────────────────────────────────────────────────────────────────────
install_node() {
  if [ -d "node_modules" ]; then
    log "node_modules exists, skipping npm install"
  else
    log "Installing Node.js dependencies..."
    npm install
  fi
}

# ──────────────────────────────────────────────────────────────────────────
# Setup environment
# ──────────────────────────────────────────────────────────────────────────
setup_env() {
  if [ ! -f ".env" ]; then
    log "Creating .env from template (SQLite mode)..."
    cp env.example .env
  else
    log ".env already exists, skipping"
  fi
}

# ──────────────────────────────────────────────────────────────────────────
# Prisma setup + seed
# ──────────────────────────────────────────────────────────────────────────
setup_db() {
  log "Generating Prisma client..."
  npx prisma generate

  log "Pushing schema to SQLite database..."
  npx prisma db push

  log "Seeding database with sample data..."
  node prisma/seed.mjs

  log "Database ready with sample data!"
}

# ──────────────────────────────────────────────────────────────────────────
# Kill any stale processes on our ports
# ──────────────────────────────────────────────────────────────────────────
kill_stale() {
  for port in 3000 3001 8000; do
    local pids
    pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
      warn "Killing stale process on port $port"
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  done
}

# ──────────────────────────────────────────────────────────────────────────
# Start dev servers
# ──────────────────────────────────────────────────────────────────────────
start_dev() {
  kill_stale

  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "  Starting PowerCouple development servers"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log ""
  log "  Frontend:  ${BLUE}http://localhost:3000${NC}"
  log ""
  log "  Press Ctrl+C to stop"
  log ""

  # Start Next.js
  npm run dev
}

# ──────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         PowerCouple - Hybrid Siting Platform      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

case "${1:-setup}" in
  dev)
    check_prereqs
    start_dev
    ;;
  seed)
    log "Re-seeding database..."
    node prisma/seed.mjs
    log "Done!"
    ;;
  reset)
    log "Resetting database..."
    rm -f dev.db
    setup_db
    log "Done! Run './setup.sh dev' to start."
    ;;
  setup|*)
    check_prereqs
    install_node
    setup_env
    setup_db
    start_dev
    ;;
esac
