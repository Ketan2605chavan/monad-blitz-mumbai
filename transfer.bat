@echo off
REM ============================================================
REM Transfer project to Linux Mint laptop via SCP
REM Run this from your Windows PC
REM ============================================================
REM
REM USAGE:  transfer.bat user@ip
REM Example: transfer.bat almeh@192.168.1.100
REM
REM ============================================================

set SSH_TARGET=shell0bee@ender3
set REMOTE_DIR=~/defi-copilot

echo.
echo ========================================
echo   Transferring DeFi Copilot to %SSH_TARGET%
echo   Remote: %REMOTE_DIR%
echo ========================================
echo.

REM Create remote directory
echo [1/5] Creating remote directory...
ssh %SSH_TARGET% "mkdir -p %REMOTE_DIR%/logs"

REM Transfer frontend (exclude node_modules and .next)
echo [2/5] Transferring frontend...
scp -r frontend\src %SSH_TARGET%:%REMOTE_DIR%/frontend/src
scp -r frontend\public %SSH_TARGET%:%REMOTE_DIR%/frontend/public 2>nul
scp frontend\package.json %SSH_TARGET%:%REMOTE_DIR%/frontend/
scp frontend\package-lock.json %SSH_TARGET%:%REMOTE_DIR%/frontend/ 2>nul
scp frontend\next.config.mjs %SSH_TARGET%:%REMOTE_DIR%/frontend/
scp frontend\tsconfig.json %SSH_TARGET%:%REMOTE_DIR%/frontend/
scp frontend\tailwind.config.ts %SSH_TARGET%:%REMOTE_DIR%/frontend/
scp frontend\postcss.config.mjs %SSH_TARGET%:%REMOTE_DIR%/frontend/
scp frontend\next-env.d.ts %SSH_TARGET%:%REMOTE_DIR%/frontend/

REM Transfer agent
echo [3/5] Transferring agent...
scp -r agent\src %SSH_TARGET%:%REMOTE_DIR%/agent/src
scp agent\package.json %SSH_TARGET%:%REMOTE_DIR%/agent/
scp agent\package-lock.json %SSH_TARGET%:%REMOTE_DIR%/agent/ 2>nul
scp agent\tsconfig.json %SSH_TARGET%:%REMOTE_DIR%/agent/

REM Transfer root config files
echo [4/5] Transferring configs...
scp .env %SSH_TARGET%:%REMOTE_DIR%/.env
scp ecosystem.config.cjs %SSH_TARGET%:%REMOTE_DIR%/
scp deploy-linux.sh %SSH_TARGET%:%REMOTE_DIR%/

REM Copy .env to frontend/.env.local on remote
echo [5/5] Setting up env files...
ssh %SSH_TARGET% "cp %REMOTE_DIR%/.env %REMOTE_DIR%/frontend/.env.local"
ssh %SSH_TARGET% "chmod +x %REMOTE_DIR%/deploy-linux.sh"

echo.
echo ========================================
echo   Transfer complete!
echo ========================================
echo.
echo   Now SSH in and run the deploy:
echo     ssh %SSH_TARGET%
echo     cd %REMOTE_DIR%
echo     bash deploy-linux.sh
echo.
pause
