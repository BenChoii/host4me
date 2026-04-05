#!/bin/bash
# =============================================================================
# Clone & Deploy — Create a new Host4Me instance for a property manager
#
# Usage: ./clone-and-deploy.sh "PM Name" "Company Name" [vps-ip]
#
# If vps-ip is provided, deploys remotely via SSH.
# If omitted, deploys locally (for the current VPS).
# =============================================================================

set -euo pipefail

PM_NAME="${1:?Usage: ./clone-and-deploy.sh \"PM Name\" \"Company Name\" [vps-ip]}"
COMPANY_NAME="${2:?Usage: ./clone-and-deploy.sh \"PM Name\" \"Company Name\" [vps-ip]}"
VPS_IP="${3:-localhost}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_TARGET="/opt/host4me"

echo "============================================"
echo "  Host4Me — Clone & Deploy"
echo "============================================"
echo "  PM: $PM_NAME"
echo "  Company: $COMPANY_NAME"
echo "  Target: $VPS_IP"
echo "============================================"
echo ""

# --- Step 1: Generate secrets ---
echo "[1/5] Generating secrets..."
VAULT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
POSTGRES_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

echo "  Vault key generated"
echo "  Database password generated"

# --- Step 2: Create .env file ---
echo "[2/5] Creating .env configuration..."
ENV_FILE="$PROJECT_DIR/.env.${COMPANY_NAME// /-}"

cat > "$ENV_FILE" << EOF
# Host4Me — $COMPANY_NAME ($PM_NAME)
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_PRIMARY=gemma4:26b
OLLAMA_MODEL_FAST=gemma4:e4b

# PostgreSQL
DATABASE_URL=postgresql://host4me:${POSTGRES_PASSWORD}@localhost:5432/host4me
POSTGRES_USER=host4me
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=host4me

# Redis
REDIS_URL=redis://localhost:6379

# Credential Vault
VAULT_ENCRYPTION_KEY=${VAULT_KEY}

# Telegram (fill in after creating bot via BotFather)
TELEGRAM_BOT_TOKENS=FILL_IN_BOT_TOKEN
TELEGRAM_WEBHOOK_BASE=https://FILL_IN_DOMAIN/api/telegram

# Paperclip
PAPERCLIP_URL=http://localhost:3100
PAPERCLIP_API_KEY=FILL_IN_KEY

# Server
PORT=3000
NODE_ENV=production

# Browser Agents
BROWSER_AGENT_URL=http://localhost:8100
BROWSER_POLL_INTERVAL_MS=180000

# Mini App
MINI_APP_URL=https://FILL_IN_DOMAIN/onboarding
EOF

echo "  .env written to: $ENV_FILE"

# --- Step 3: Clone Paperclip company ---
echo "[3/5] Creating Paperclip company from template..."
node "$PROJECT_DIR/backend/paperclip/clone-company.js" \
  --name "$COMPANY_NAME" \
  --pm "$PM_NAME" \
  --dry-run

echo "  (Dry run — company will be created after Paperclip is running)"

# --- Step 4: Deploy ---
if [ "$VPS_IP" = "localhost" ]; then
  echo "[4/5] Deploying locally..."

  # Copy project files
  if [ "$PROJECT_DIR" != "$DEPLOY_TARGET" ]; then
    rsync -av --exclude=node_modules --exclude=.git --exclude='.env*' \
      "$PROJECT_DIR/" "$DEPLOY_TARGET/"
  fi

  # Copy env
  cp "$ENV_FILE" "$DEPLOY_TARGET/.env"

  # Install backend deps
  cd "$DEPLOY_TARGET/backend" && npm install --production

  # Start services
  cd "$DEPLOY_TARGET/deploy" && docker compose up -d

  echo "  Services started locally"
else
  echo "[4/5] Deploying to remote VPS: $VPS_IP..."

  # Run setup script on remote VPS if needed
  echo "  Checking if VPS is bootstrapped..."
  ssh "root@$VPS_IP" 'command -v ollama' > /dev/null 2>&1 || {
    echo "  VPS not bootstrapped. Running setup.sh first..."
    ssh "root@$VPS_IP" 'bash -s' < "$SCRIPT_DIR/setup.sh"
  }

  # Sync project files
  rsync -avz --exclude=node_modules --exclude=.git --exclude='.env*' \
    "$PROJECT_DIR/" "root@$VPS_IP:$DEPLOY_TARGET/"

  # Copy env
  scp "$ENV_FILE" "root@$VPS_IP:$DEPLOY_TARGET/.env"

  # Install deps and start
  ssh "root@$VPS_IP" "cd $DEPLOY_TARGET/backend && npm install --production"
  ssh "root@$VPS_IP" "cd $DEPLOY_TARGET/deploy && docker compose up -d"

  echo "  Services started on $VPS_IP"
fi

# --- Step 5: Post-deploy ---
echo "[5/5] Post-deployment checklist..."
echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "Manual steps remaining:"
echo "  1. Create a Telegram bot via @BotFather"
echo "     - Name it: @Host4Me_${COMPANY_NAME// /_}_bot"
echo "     - Add the token to .env (TELEGRAM_BOT_TOKENS)"
echo ""
echo "  2. Set up DNS: point your domain to $VPS_IP"
echo ""
echo "  3. Get SSL: certbot --nginx -d yourdomain.com"
echo ""
echo "  4. Update .env with domain for:"
echo "     - TELEGRAM_WEBHOOK_BASE"
echo "     - MINI_APP_URL"
echo ""
echo "  5. Create the Paperclip company (after Paperclip is running):"
echo "     node backend/paperclip/clone-company.js \\"
echo "       --name \"$COMPANY_NAME\" --pm \"$PM_NAME\" \\"
echo "       --telegram-token YOUR_BOT_TOKEN"
echo ""
echo "  6. Send the PM their Telegram bot link to start onboarding"
echo ""
echo "Environment file: $ENV_FILE"
echo ""
