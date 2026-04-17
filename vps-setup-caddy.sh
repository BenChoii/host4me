#!/bin/bash
set -e

echo "=== Host4Me VPS: Setting up Caddy HTTPS reverse proxy ==="

# 1. Stop Traefik (it's using ports 80/443 with a self-signed cert)
echo "[1/4] Stopping Traefik..."
docker stop traefik 2>/dev/null && docker rm traefik 2>/dev/null && echo "  Stopped Traefik (Docker)" || true
systemctl stop traefik 2>/dev/null && systemctl disable traefik 2>/dev/null && echo "  Stopped Traefik (systemd)" || true

# 2. Install Caddy
echo "[2/4] Installing Caddy..."
apt-get update -qq
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl > /dev/null 2>&1
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
apt-get update -qq
apt-get install -y -qq caddy > /dev/null 2>&1
echo "  Caddy installed: $(caddy version)"

# 3. Write Caddyfile
echo "[3/4] Writing Caddyfile..."
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
187-124-182-236.sslip.io {
    # Live browser session API
    handle /sessions/* {
        reverse_proxy localhost:8101
    }
    handle /health {
        reverse_proxy localhost:8101
    }

    # noVNC proxy: /vnc/{port}/* -> localhost:{port}/*
    # This lets us serve noVNC over HTTPS through a single domain
    @vnc path_regexp vnc ^/vnc/(\d+)(.*)$
    handle @vnc {
        rewrite * {re.vnc.2}
        reverse_proxy localhost:{re.vnc.1} {
            # WebSocket support for noVNC
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Worker agent API
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:8100
    }
}
CADDYEOF

echo "  Caddyfile written to /etc/caddy/Caddyfile"

# 4. Restart Caddy
echo "[4/4] Starting Caddy..."
systemctl enable caddy
systemctl restart caddy
sleep 3

# Verify
if systemctl is-active --quiet caddy; then
    echo ""
    echo "=== SUCCESS ==="
    echo "Caddy is running with HTTPS on 187-124-182-236.sslip.io"
    echo "  - noVNC proxy: https://187-124-182-236.sslip.io/vnc/{port}/vnc.html"
    echo "  - Session API: https://187-124-182-236.sslip.io/sessions/*"
    echo "  - Worker API:  https://187-124-182-236.sslip.io/api/*"
else
    echo ""
    echo "=== FAILED ==="
    echo "Caddy failed to start. Check logs:"
    echo "  journalctl -u caddy --no-pager -n 20"
fi
