#!/bin/bash
# =============================================================================
# Host4Me VPS Bootstrap Script
# Run on a fresh Hostinger VPS (Ubuntu 24.04 LTS, 32GB RAM, 8 vCPU)
# =============================================================================

set -euo pipefail

echo "============================================"
echo "  Host4Me VPS Setup"
echo "============================================"

# --- System updates ---
echo "[1/8] Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git build-essential nginx certbot python3-certbot-nginx

# --- Docker ---
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi
apt-get install -y docker-compose-plugin

# --- Node.js 22 LTS ---
echo "[3/8] Installing Node.js 22 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# --- Python 3.12 + pip ---
echo "[4/8] Installing Python 3.12..."
apt-get install -y python3 python3-pip python3-venv

# --- Ollama ---
echo "[5/8] Installing Ollama..."
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
fi

# --- Download Gemma 4 models ---
echo "[6/8] Downloading Gemma 4 CPU-optimized models..."
ollama pull gemma4:e4b
ollama pull gemma4:e2b

# Verify models loaded
echo "Verifying models..."
ollama list

# --- Google ADK ---
echo "[7/8] Installing Google ADK..."
pip3 install "google-adk[extensions]>=1.28.0"

# --- Project setup ---
echo "[8/8] Setting up Host4Me..."
PROJECT_DIR="/opt/host4me"

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    echo "Clone or copy the host4me repo to $PROJECT_DIR"
fi

# Copy nginx config
cp "$PROJECT_DIR/deploy/nginx.conf" /etc/nginx/sites-available/host4me
ln -sf /etc/nginx/sites-available/host4me /etc/nginx/sites-enabled/host4me
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL certificate
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Update /etc/nginx/sites-available/host4me with your domain"
echo "  2. Run: certbot --nginx -d yourdomain.com"
echo "  3. Copy .env.example to .env and fill in values"
echo "  4. Run: cd $PROJECT_DIR/deploy && docker compose up -d"
echo "  5. Verify Ollama: curl http://localhost:11434/api/tags"
echo "  6. Verify ADK Runner: curl http://localhost:3200/health"
echo ""
echo "Gemma 4 models installed:"
ollama list
echo ""
echo "System resources:"
echo "  RAM: $(free -h | awk '/^Mem:/{print $2}')"
echo "  CPU: $(nproc) cores"
echo "  Disk: $(df -h / | awk 'NR==2{print $4}') available"
