#!/bin/bash
# =============================================================================
# Mailer-US — VPS Setup Script for Ubuntu 22.04 / 24.04
# Includes Tor + IP Changer setup
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

# ── 6. Tor + IP Changer ───────────────────────────────────────────────────────
info "Installing Tor for IP rotation..."
apt-get install -y -qq tor netcat-openbsd

# Enable control port for NEWNYM signal
if grep -q "^ControlPort" /etc/tor/torrc 2>/dev/null; then
  info "ControlPort already configured in torrc"
else
  echo "" >> /etc/tor/torrc
  echo "# Added by Mailer-US for IP Changer" >> /etc/tor/torrc
  echo "ControlPort 9051" >> /etc/tor/torrc
  echo "CookieAuthentication 0" >> /etc/tor/torrc
fi

systemctl enable --now tor
sleep 2
log "Tor running on 127.0.0.1:9050 (SOCKS5) and :9051 (Control)"

# Test Tor is working
TOR_TEST=$(curl --socks5 127.0.0.1:9050 -s --max-time 10 https://api.ipify.org 2>/dev/null || echo "timeout")
if [ "$TOR_TEST" = "timeout" ] || [ -z "$TOR_TEST" ]; then
  echo -e "${YELLOW}[!] Tor test timed out — may need more time to bootstrap. Continuing...${NC}"
else
  log "Tor test passed — exit IP: $TOR_TEST"
fi
# ───────────────────────────────────────────────────────────────────────────────

# ── 7. Backend .env ───────────────────────────────────────────────────────────
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
TRACKING_DOMAIN=https://track.tunstake.com
BASE_URL=http://${VPS_HOSTNAME:-localhost}:${BACKEND_PORT}
EOF
log ".env written"

# ── 8. Install Backend Dependencies ───────────────────────────────────────────
info "Installing backend npm dependencies..."
npm install --prefix "$APP_DIR/backend" --silent --omit=dev
log "Dependencies installed (socks package included)"

# ── 9. Build Frontend ─────────────────────────────────────────────────────────
info "Building frontend..."
cd "$APP_DIR/frontend"
npm install --silent
npm run build --silent
log "Frontend built to backend/public/"

# ── 10. Build & Start Postfix Mail Relay (Docker) ─────────────────────────────
info "Building Postfix relay Docker image..."
VPS_HOSTNAME="$VPS_HOSTNAME" docker compose -f "$APP_DIR/backend/docker-compose.yml" up -d --build
log "Postfix relay running on 127.0.0.1:2525"

# ── 11. Start Backend & Worker with PM2 ───────────────────────────────────────
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

# ── 12. Firewall ──────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 4000/tcp
ufw --force enable
log "Firewall configured"

# ── 13. Summary ───────────────────────────────────────────────────────────────
VPS_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "unknown")

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅  Mailer-US + Tor IP Changer Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  API Server    →  http://${VPS_IP}:${BACKEND_PORT}"
echo "  Tor SOCKS5    →  127.0.0.1:9050"
echo "  Tor Control   →  127.0.0.1:9051"
echo "  PM2 Status    →  pm2 list"
echo "  API Logs      →  pm2 logs mailer-api"
echo "  Worker Logs   →  pm2 logs mailer-worker"
echo "  Postfix       →  docker logs mailer-postfix-relay"
echo ""
echo -e "${YELLOW}  Post-install steps:${NC}"
echo "  1. Open http://${VPS_IP}:${BACKEND_PORT} in browser"
echo "  2. Register an account → wait for approval → or manually approve in MongoDB"
echo "  3. Go to Settings → IP Changer → set interval → Start"
echo "  4. Watch live IP rotation in the UI"
echo ""

# ── Port 25 reminder ──────────────────────────────────────────────────────────
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  ⚠  If using Hostinger: unblock outbound port 25 in the panel${NC}"
echo -e "${YELLOW}  ⚠  Set PTR record for ${VPS_IP} → ${VPS_HOSTNAME}${NC}"
echo -e "${YELLOW}  ⚠  (Optional) Set up Nginx reverse proxy + SSL${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
