#!/bin/bash
# Host4Me VPS Startup Script
# Run this once after git pull to start all services
# Usage: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
BROWSER_DIR="$BACKEND_DIR/browser"
ENV_FILE="$BACKEND_DIR/.env"
LOG_DIR="/var/log/host4me"
VENV="$BROWSER_DIR/venv"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
die()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════╗"
echo "║   Host4Me Service Launcher   ║"
echo "╚══════════════════════════════╝"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────

[ -f "$ENV_FILE" ] || die ".env not found at $BACKEND_DIR/.env — copy .env.example and fill it in"
ok ".env found"

mkdir -p "$LOG_DIR"
ok "Log dir: $LOG_DIR"

# ── Kill stale processes ──────────────────────────────────────────────────────

echo ""
echo "Stopping any running services..."

# Kill old browser service (port 8100)
if lsof -ti:8100 >/dev/null 2>&1; then
    kill $(lsof -ti:8100) 2>/dev/null && warn "Killed old browser service on :8100"
fi

# Kill old Express server (port 3000)
if lsof -ti:3000 >/dev/null 2>&1; then
    kill $(lsof -ti:3000) 2>/dev/null && warn "Killed old Express server on :3000"
fi

sleep 1

# ── Python venv + browser service ────────────────────────────────────────────

echo ""
echo "Starting Python browser service..."

# Create venv if missing
if [ ! -d "$VENV" ]; then
    echo "  Creating Python venv..."
    python3 -m venv "$VENV"
fi

# Install / upgrade requirements
"$VENV/bin/pip" install -q -r "$BROWSER_DIR/requirements.txt"
ok "Python deps installed"

# Source env vars for the browser service
set -a; source "$ENV_FILE"; set +a

# Start browser service in background
nohup "$VENV/bin/python" "$BROWSER_DIR/service.py" \
    >"$LOG_DIR/browser-service.log" 2>&1 &
BROWSER_PID=$!
echo $BROWSER_PID > /tmp/host4me-browser.pid
ok "Browser service started (PID $BROWSER_PID) — logs: $LOG_DIR/browser-service.log"

# ── Wait for browser service to be ready ─────────────────────────────────────

echo ""
echo "Waiting for browser service on :8100..."
for i in $(seq 1 15); do
    if curl -sf http://localhost:8100/health >/dev/null 2>&1; then
        ok "Browser service is healthy"
        break
    fi
    if [ $i -eq 15 ]; then
        warn "Browser service didn't respond in 15s — check $LOG_DIR/browser-service.log"
    fi
    sleep 1
done

# ── Node.js Express server ────────────────────────────────────────────────────

echo ""
echo "Starting Node.js server..."

cd "$BACKEND_DIR"
npm install -q --no-fund 2>/dev/null || true

# Start Express server in background
nohup node server.js \
    >"$LOG_DIR/express.log" 2>&1 &
NODE_PID=$!
echo $NODE_PID > /tmp/host4me-node.pid
ok "Express server started (PID $NODE_PID) — logs: $LOG_DIR/express.log"

# ── Wait for Express to be ready ─────────────────────────────────────────────

echo ""
echo "Waiting for Express on :3000..."
for i in $(seq 1 10); do
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        ok "Express server is healthy"
        break
    fi
    if [ $i -eq 10 ]; then
        warn "Express didn't respond in 10s — check $LOG_DIR/express.log"
    fi
    sleep 1
done

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║  All services started                 ║"
echo "╠═══════════════════════════════════════╣"
printf "║  Browser service  :8100   PID %-6s  ║\n" "$BROWSER_PID"
printf "║  Express server   :3000   PID %-6s  ║\n" "$NODE_PID"
echo "╠═══════════════════════════════════════╣"
echo "║  Logs: /var/log/host4me/              ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "To tail all logs:  tail -f /var/log/host4me/*.log"
echo "To stop:           kill \$(cat /tmp/host4me-browser.pid /tmp/host4me-node.pid)"
echo ""
