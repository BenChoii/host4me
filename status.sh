#!/bin/bash
# Show status of all Host4Me services

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

check() {
    local name=$1 url=$2
    if curl -sf "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name ($url)"
        curl -s "$url" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   ', json.dumps(d, indent=2))" 2>/dev/null || true
    else
        echo -e "${RED}✗${NC} $name ($url) — NOT RUNNING"
    fi
}

echo ""
echo "Host4Me Service Status"
echo "══════════════════════"
check "Browser service" "http://localhost:8100/health"
echo ""
check "Express server  " "http://localhost:3000/api/health"
echo ""
