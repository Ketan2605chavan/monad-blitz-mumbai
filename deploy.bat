@echo off
REM ============================================================
REM DeFi Copilot — Production Deploy Script (Windows)
REM Domain: monad.tabcrypt.in via Cloudflare Tunnel
REM ============================================================

echo.
echo ========================================
echo   DeFi Copilot — Production Deploy
echo   Domain: monad.tabcrypt.in
echo ========================================
echo.

REM Create logs directory
if not exist "logs" mkdir logs

REM ── Step 1: Build Frontend ─────────────────────────────────
echo [1/4] Building Next.js frontend...
cd frontend
call npm install --production=false
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
cd ..
echo       Frontend built successfully!
echo.

REM ── Step 2: Build Agent ────────────────────────────────────
echo [2/4] Building Agent...
cd agent
call npm install --production=false
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Agent build failed!
    pause
    exit /b 1
)
cd ..
echo       Agent built successfully!
echo.

REM ── Step 3: Start with PM2 ────────────────────────────────
echo [3/4] Starting services with PM2...
call pm2 delete all 2>nul
call pm2 start ecosystem.config.cjs
call pm2 save
echo       PM2 services started!
echo.

REM ── Step 4: Start Cloudflare Tunnel ───────────────────────
echo [4/4] Starting Cloudflare Tunnel...
echo       Domain: monad.tabcrypt.in
echo.
echo       Make sure you have:
echo         1. Replaced ^<TUNNEL_UUID^> in cloudflare-tunnel.yml
echo         2. Run: cloudflared tunnel route dns defi-copilot monad.tabcrypt.in
echo.
echo       Starting tunnel now...
start "Cloudflare Tunnel" cloudflared tunnel --config cloudflare-tunnel.yml run
echo.

echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo   Frontend:  http://localhost:3005
echo   Live URL:  https://monad.tabcrypt.in
echo   Agent:     Running via PM2
echo   Tunnel:    Running in separate window
echo.
echo   Useful commands:
echo     pm2 status          — check running services
echo     pm2 logs            — view live logs
echo     pm2 restart all     — restart everything
echo     pm2 monit           — monitoring dashboard
echo.
pause
