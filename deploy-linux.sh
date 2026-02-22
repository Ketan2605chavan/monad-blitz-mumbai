#!/bin/bash
# ============================================================
# DeFi Copilot — Remote Deploy Script for Linux Mint
# Run this ON the Mint laptop (via SSH or directly)
# ============================================================

set -e

DEPLOY_DIR="/home/shell0bee/defi-copilot"
echo ""
echo "========================================"
echo "  DeFi Copilot — Linux Mint Deploy"
echo "  Domain: monad.tabcrypt.in"
echo "========================================"
echo ""

# ── Step 0: Install Node.js 20 if not present ──────────────
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
    echo "[0/6] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "      Node $(node -v) installed!"
else
    echo "[0/6] Node.js $(node -v) already installed ✓"
fi

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo "      Installing PM2..."
    sudo npm install -g pm2
fi

echo ""

# ── Step 1: Setup directory ─────────────────────────────────
echo "[1/6] Setting up $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR/logs"
cd "$DEPLOY_DIR"
echo "      Directory ready ✓"
echo ""

# ── Step 2: Install frontend dependencies ───────────────────
echo "[2/6] Installing frontend dependencies..."
cd "$DEPLOY_DIR/frontend"
npm install
echo "      Frontend deps installed ✓"
echo ""

# ── Step 3: Build frontend ──────────────────────────────────
echo "[3/6] Building Next.js frontend..."
npm run build
echo "      Frontend built ✓"
echo ""

# ── Step 4: Install & build agent ───────────────────────────
echo "[4/6] Installing & building agent..."
cd "$DEPLOY_DIR/agent"
npm install
npm run build
echo "      Agent built ✓"
echo ""

# ── Step 5: Start services with PM2 ─────────────────────────
echo "[5/6] Starting services with PM2..."
cd "$DEPLOY_DIR"
pm2 delete defi-copilot-frontend 2>/dev/null || true
pm2 delete defi-copilot-agent 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
# Auto-start PM2 on boot
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true
echo "      PM2 services running ✓"
echo ""

# ── Step 6: Add DNS route to Cloudflare Tunnel ──────────────
echo "[6/6] Cloudflare Tunnel setup..."
echo ""
echo "  You need to add the monad.tabcrypt.in route."
echo "  Two options:"
echo ""
echo "  OPTION A — Via Cloudflare Dashboard (easiest):"
echo "    1. Go to: https://one.dash.cloudflare.com → Networks → Tunnels"
echo "    2. Click 'apex-server' → Public Hostname tab"
echo "    3. Click 'Add a public hostname'"
echo "    4. Subdomain: monad  |  Domain: tabcrypt.in"
echo "    5. Service Type: HTTP  |  URL: localhost:3000"
echo "    6. Save"
echo ""
echo "  OPTION B — Via CLI:"
echo "    cloudflared tunnel route dns apex-server monad.tabcrypt.in"
echo "    Then add to ~/.cloudflared/config.yml:"
echo "      - hostname: monad.tabcrypt.in"
echo "        service: http://localhost:3000"
echo "    Then: sudo systemctl restart cloudflared"
echo ""

echo "========================================"
echo "  DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "  Local:    http://localhost:3000"
echo "  Live:     https://monad.tabcrypt.in"
echo ""
echo "  Commands:"
echo "    pm2 status       — check services"
echo "    pm2 logs         — view logs"
echo "    pm2 restart all  — restart"
echo "    pm2 monit        — dashboard"
echo ""
