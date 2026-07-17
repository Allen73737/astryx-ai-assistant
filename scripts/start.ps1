# JARVIS-X Start Script
# Launches both backend and frontend

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         ASTRYX — LAUNCHING               ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# ── Start Backend ──
Write-Host "[1/2] Starting backend server..." -ForegroundColor Yellow
$backendJob = Start-Process -PassThru -WindowStyle Hidden -FilePath "python" -ArgumentList "main.py" -WorkingDirectory (Join-Path $projectRoot "backend")
Write-Host "  ✓ Backend starting on http://localhost:8002 (PID: $($backendJob.Id))" -ForegroundColor Green

# Wait for backend to be ready
Write-Host "  Waiting for backend..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5

# ── Start Frontend ──
Write-Host "[2/2] Starting Electron app..." -ForegroundColor Yellow
Set-Location $projectRoot
npm run dev

# Cleanup on exit
Write-Host ""
Write-Host "Shutting down..." -ForegroundColor Yellow
Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
Write-Host "ASTRYX stopped." -ForegroundColor Cyan
