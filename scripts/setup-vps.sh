#!/bin/bash
# =============================================================================
# Mailer-US — VPS Setup Script for Ubuntu 22.04 / 24.04
# Run as root:  bash setup-vps.sh
# =============================================================================
set -euo pipefail

# ── CONFIGURATION — edit these before running ────────────────────────────────
REPO_URL="https://github.com/ayaanoski/mailer-us.git"
APP_DIR="/opt/mailer-us"

MONGO_URI="mongodb+srv://tuhinthakur1233:DY2p354LuqgXPef0@cluster0.r5uuwtr.mongodb.net/MAIL_DB?retryWrites=true&w=majority&appName=Cluster0"
REDIS_HOST="34.193.197.104"
REDIS_PORT="6379"
JWT_SECRET="IGUG*&^98977^**"
SMTP_ENCRYPTION_KEY="51deb3a402625dfc5eb28c8ed2dc72449065e11bdc76dafec761bc33dbc319e7"

# Set this to the hostname that resolves to this VPS's IP (used in SMTP HELO)
# e.g., if your VPS IP reverse-resolves to vps-123.hostinger.com, use that.
VPS_HOSTNAME="mail.mailer-us.com"

BACKEND_PORT="4000"
# ─────────────────────────────────────────────────────────────────────────────

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Run this script as root (sudo bash setup-vps.sh)"

# ── 1. System Update ──────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw
log "System updated"

# ── 2. Node.js 20 LTS ─────────────────────────────────────────────────────────
info "Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs
log "Node.js $(node -v) installed"

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
info "Installing PM2..."
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root | tail -1 | bash >/dev/null 2>&1
log "PM2 installed"

# ── 4. Docker ─────────────────────────────────────────────────────────────────
info "Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
fi
systemctl enable --now docker >/dev/null 2>&1
log "Docker $(docker --version | cut -d' ' -f3) installed"

# ── 5. Clone Repo ─────────────────────────────────────────────────────────────
info "Cloning repository..."
if [ -d "$APP_DIR" ]; then
  info "Directory exists — pulling latest changes..."
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
log "Repository ready at $APP_DIR"

# ── 6. Backend .env ───────────────────────────────────────────────────────────
info "Writing backend .env..."
cat > "$APP_DIR/backend/.env" <<EOF
PORT=${BACKEND_PORT}
MONGO_URI=${MONGO_URI}
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}
JWT_SECRET="${JWT_SECRET}"
MAIL_RELAY_HOST=127.0.0.1
MAIL_RELAY_PORT=2525
MAIL_RELAY_IGNORE_TLS=true
VPS_HOSTNAME=${VPS_HOSTNAME}
SMTP_ENCRYPTION_KEY=${SMTP_ENCRYPTION_KEY}
EOF
log ".env written"

# ── 7. Install Backend Dependencies ───────────────────────────────────────────
info "Installing backend npm dependencies..."
npm install --prefix "$APP_DIR/backend" --silent --omit=dev
log "Dependencies installed"

# ── 8. Build & Start Postfix Mail Relay (Docker) ──────────────────────────────
info "Building Postfix relay Docker image..."
VPS_HOSTNAME="$VPS_HOSTNAME" docker compose -f "$APP_DIR/backend/docker-compose.yml" up -d --build
log "Postfix relay running on 127.0.0.1:2525"

# ── 9. Start Backend & Worker with PM2 ────────────────────────────────────────
info "Starting API server and email worker with PM2..."
pm2 delete mailer-api mailer-worker 2>/dev/null || true

pm2 start "$APP_DIR/backend/src/server.js" \
  --name "mailer-api" \
  --cwd "$APP_DIR/backend" \
  --time \
  --restart-delay=3000

pm2 start "$APP_DIR/backend/src/queues/worker.js" \
  --name "mailer-worker" \
  --cwd "$APP_DIR/backend" \
  --time \
  --restart-delay=3000

pm2 save
log "PM2 processes started and saved"

# ── 10. Firewall ──────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 4000/tcp   # API port (restrict to your IP in production)
ufw --force enable
log "Firewall configured"

# ── 11. Open Port 25 (SMTP outbound) ──────────────────────────────────────────
info "Checking if port 25 is blocked by Hostinger..."
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  ACTION REQUIRED: Unblock Port 25 in Hostinger VPS panel${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Hostinger blocks outbound port 25 by default."
echo "  Go to: Hostinger hPanel → VPS → Your VPS → Firewall"
echo "  Allow outbound port 25 (TCP)"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
VPS_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "unknown")

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅  Mailer-US Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  API Server  →  http://${VPS_IP}:${BACKEND_PORT}"
echo "  PM2 Status  →  pm2 list"
echo "  API Logs    →  pm2 logs mailer-api"
echo "  Worker Logs →  pm2 logs mailer-worker"
echo "  Postfix     →  docker logs mailer-postfix-relay"
echo ""
echo -e "${YELLOW}  Next steps:${NC}"
echo "  1. Unblock outbound port 25 in Hostinger VPS Firewall panel"
echo "  2. Set a PTR/reverse-DNS record for ${VPS_IP} → ${VPS_HOSTNAME}"
echo "  3. Point your frontend API base URL to http://${VPS_IP}:${BACKEND_PORT}"
echo "  4. (Optional) Put Nginx in front with SSL"
echo ""
