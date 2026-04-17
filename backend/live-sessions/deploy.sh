#!/bin/bash
set -e

echo "=== Host4Me Live Sessions: Deploy with Stealth + Proxy ==="

# 1. Install system dependencies for headed browser + noVNC
echo "[1/5] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
  xvfb x11vnc novnc websockify \
  fonts-liberation fonts-noto-color-emoji \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libxshmfence1 > /dev/null 2>&1
echo "  Done"

# 2. Set up Python venv
echo "[2/5] Setting up Python virtual environment..."
VENV_DIR="/opt/host4me/live-sessions-venv"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

# 3. Install Python dependencies
echo "[3/5] Installing Python dependencies..."
pip install -q -r /opt/host4me/backend/live-sessions/requirements.txt
playwright install chromium
playwright install-deps chromium
echo "  Done"

# 4. Create systemd service
echo "[4/5] Creating systemd service..."
cat > /etc/systemd/system/host4me-live-sessions.service << 'EOF'
[Unit]
Description=Host4Me Live Browser Sessions (Stealth + Proxy)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/host4me/backend/live-sessions
Environment=LIVE_SESSION_PORT=8101
Environment=HOST4ME_DATA_DIR=/opt/host4me/data
# ──────────────────────────────────────────────────────────
# RESIDENTIAL PROXY — Required for VRBO/Airbnb bot bypass
# Sign up at one of these providers:
#   - Bright Data:   https://brightdata.com
#   - IPRoyal:       https://iproyal.com
#   - SmartProxy:    https://smartproxy.com
#   - Oxylabs:       https://oxylabs.io
#
# Then set the proxy URL below:
# ──────────────────────────────────────────────────────────
# Environment=PROXY_SERVER=http://user:pass@proxy-host:port
# Environment=PROXY_USERNAME=your_username
# Environment=PROXY_PASSWORD=your_password
ExecStart=/opt/host4me/live-sessions-venv/bin/python live_session_service.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 5. Start the service
echo "[5/5] Starting service..."
systemctl daemon-reload
systemctl enable host4me-live-sessions
systemctl restart host4me-live-sessions
sleep 2

if systemctl is-active --quiet host4me-live-sessions; then
  echo ""
  echo "=== SUCCESS ==="
  echo "Live Sessions service running on port 8101"
  echo ""
  echo "IMPORTANT: To bypass bot detection on VRBO/Airbnb, you MUST set up"
  echo "a residential proxy. Edit the service file:"
  echo ""
  echo "  sudo nano /etc/systemd/system/host4me-live-sessions.service"
  echo ""
  echo "Uncomment and fill in the PROXY_SERVER line, then:"
  echo ""
  echo "  sudo systemctl daemon-reload && sudo systemctl restart host4me-live-sessions"
  echo ""
  echo "Test: curl http://localhost:8101/health"
else
  echo ""
  echo "=== FAILED ==="
  echo "Service failed to start. Check logs:"
  echo "  journalctl -u host4me-live-sessions --no-pager -n 30"
fi
