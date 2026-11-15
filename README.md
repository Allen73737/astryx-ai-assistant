# ASTRYX — Sovereign Autonomous AI Assistant (Mark IV)

Astryx is an ultra-advanced autonomous AI personal assistant engineered with god-mode computer access, unrestricted real-time internet search, live web browsing, and comprehensive OS control—surpassing the fictional capabilities of Tony Stark's J.A.R.V.I.S. and F.R.I.D.A.Y.

---

## ⚡ Supercharged Capabilities

### 1. Live Internet & Web Intelligence
- **Deep Web Search**: Real-time web search powered by DuckDuckGo and Wikipedia with live extracts, URLs, and summaries.
- **Webpage Reader / Deep Scraper**: Scrapes and extracts the readable article text and documentation from any URL.
- **Real-Time News Engine**: Live breaking news headlines across Tech, AI, Science, Business, and World news via Google News RSS.
- **Live Weather & Forecasts**: Real-time meteorological telemetry for any city or location on Earth.
- **Browser Automation**: Opens searches, YouTube videos, GitHub repositories, and links directly in the user's default browser.

### 2. Full Computer Access & God-Mode OS Control
- **Arbitrary Command Execution**: Executes any PowerShell, CMD, or terminal commands with full administrator privileges, returning stdout and stderr.
- **Dynamic Python Sandbox**: Runs on-the-fly Python scripts and calculations directly on the system.
- **Full File System Control**: Read, write, create, append, and recursively search files across the entire drive.
- **Live System Telemetry**: CPU % usage, RAM (used/total), disk storage %, battery level & charging state, IP address, and uptime.
- **Process & Task Manager**: Monitor top memory/CPU processes, inspect active threads, and terminate any process by PID or name.
- **Desktop & Window Management**: Enumerate open application windows, switch focus, or control desktop applications (VS Code, Notepad, Chrome, Terminal, Calc, Spotify).
- **Hardware & Desktop Controls**: System volume up/down/mute, lock workstation, empty recycle bin, screen captures, and clipboard read/write.

### 3. Dual Hybrid Brain Architecture
- **Groq Cloud Engine**: Ultra-fast inference (>300 tokens/sec) with Qwen 2.5 32B / Llama 3.3 / GPT-OSS for instant multi-step reasoning and function calling.
- **Dynamic Local Failover**: Automatically fails over to local LM Studio or Ollama if offline, ensuring Astryx is never disabled.
- **Autonomous ReAct Agent Loop**: Iterative multi-step reasoning (Plan ➔ Act ➔ Observe ➔ Synthesize) with up to 10 sequential tool calls per directive.

### 4. Neural Voice & Cybernetic HUD
- **Neural Speech Synthesis**: Natural Microsoft Neural TTS voices (`en-US-ChristopherNeural` and `ml-IN-MidhunNeural` for Malayalam).
- **Speech Recognition**: Faster-Whisper on-device multilingual audio transcription.
- **Stark Arc Reactor HUD**: Holographic reactor orb reactive to system states (Idle, Listening, Thinking, Speaking, Tool Execution).
- **Interactive Command Palette**: Multi-turn conversation display, live token streaming, quick directive pills, voice toggle, and keyboard text input.

---

## 🚀 Quick Start

### 1. One-Click Launch
Double-click `Start_Astryx.bat` in the project root:
```cmd
Start_Astryx.bat
```

### 2. Manual Startup
**Terminal 1 — Python AI Neural Backend:**
```cmd
cd backend
.venv\Scripts\python.exe main.py
```

**Terminal 2 — Electron Cybernetic HUD:**
```cmd
npm run dev
```
