#!/bin/bash
# Stop all Host4Me services

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo "Stopping Host4Me services..."

for pidfile in /tmp/host4me-browser.pid /tmp/host4me-node.pid; do
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if kill "$PID" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} Stopped PID $PID"
        fi
        rm -f "$pidfile"
    fi
done

# Also kill by port in case PIDs are stale
lsof -ti:8100 | xargs kill 2>/dev/null && echo -e "${YELLOW}⚠${NC}  Killed stale :8100 process" || true
lsof -ti:3000 | xargs kill 2>/dev/null && echo -e "${YELLOW}⚠${NC}  Killed stale :3000 process" || true

echo "Done."
