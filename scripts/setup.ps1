# JARVIS-X Setup Script
# Run this once to set up the entire project

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         JARVIS-X — SETUP SCRIPT          ║" -ForegroundColor Cyan
Write-Host "  ║    Local AI Desktop Assistant Setup       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

# ── Check Prerequisites ──
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Python
$pythonVersion = python --version 2>$null
if ($pythonVersion) {
    Write-Host "  ✓ $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Python not found. Install Python 3.11+ from https://python.org" -ForegroundColor Red
    exit 1
}

# ── Install Node Dependencies ──
Write-Host ""
Write-Host "[2/5] Installing Node.js dependencies..." -ForegroundColor Yellow
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Node dependencies installed" -ForegroundColor Green

# ── Setup Python Virtual Environment ──
Write-Host ""
Write-Host "[3/5] Setting up Python environment..." -ForegroundColor Yellow

$venvPath = Join-Path $projectRoot "backend\.venv"
if (!(Test-Path $venvPath)) {
    python -m venv $venvPath
    Write-Host "  ✓ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "  ✓ Virtual environment exists" -ForegroundColor Green
}

# Activate and install
& "$venvPath\Scripts\pip.exe" install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ pip install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Python dependencies installed" -ForegroundColor Green

# ── Create Data Directories ──
Write-Host ""
Write-Host "[4/5] Creating data directories..." -ForegroundColor Yellow
$dirs = @("backend\data", "backend\data\chroma", "data")
foreach ($dir in $dirs) {
    $fullPath = Join-Path $projectRoot $dir
    if (!(Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
    }
}
Write-Host "  ✓ Data directories ready" -ForegroundColor Green

# ── LM Studio Instructions ──
Write-Host ""
Write-Host "[5/5] LM Studio Configuration" -ForegroundColor Yellow
Write-Host ""
Write-Host "  JARVIS-X requires LM Studio running at http://localhost:1234" -ForegroundColor White
Write-Host ""
Write-Host "  Required model (already installed):" -ForegroundColor White
Write-Host "    • gemma-4-e4b — Primary conversation model" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Optional models (install in LM Studio for full features):" -ForegroundColor White
Write-Host "    • qwen3 — Coding and tool execution" -ForegroundColor DarkCyan
Write-Host "    • phi-4-mini — Fast intent routing" -ForegroundColor DarkCyan
Write-Host "    • qwen2.5-vl — Vision and screen understanding" -ForegroundColor DarkCyan
Write-Host "    • nomic-embed-text — Memory embeddings" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Steps:" -ForegroundColor White
Write-Host "    1. Open LM Studio" -ForegroundColor White
Write-Host "    2. Start the local server (port 1234)" -ForegroundColor White
Write-Host "    3. Load gemma-4-e4b" -ForegroundColor White
Write-Host "    4. Run: .\scripts\start.ps1" -ForegroundColor White

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║         SETUP COMPLETE ✓                 ║" -ForegroundColor Green
Write-Host "  ║    Run .\scripts\start.ps1 to launch     ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
