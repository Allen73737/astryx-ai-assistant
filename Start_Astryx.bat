@echo off
title Starting Astryx Sovereign Mark IV...
cd /d "c:\My_Project\Astryx"

rem Clear editor environmental overrides
set ELECTRON_RUN_AS_NODE=

echo ============================================================
echo   ASTRYX SOVEREIGN MARK IV — HYBRID AI & OS CONTROL ENGINE
echo ============================================================

echo [1/3] Ensuring backend port 8002 is clean...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

echo [2/3] Initializing Neural Core & Full Computer Access Engine...
start "Astryx Neural Core" "backend\.venv\Scripts\python.exe" backend\main.py

timeout /t 2 /nobreak >nul
echo [3/3] Launching Astryx Cybernetic HUD...
npm run dev

