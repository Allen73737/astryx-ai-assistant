<div align="center">

<a href="https://github.com/Allen73737/astryx-ai-assistant">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=40&pause=1000&color=00E5FF&center=true&vCenter=true&width=800&height=120&lines=%5B+SYSTEM+ONLINE+%5D;ASTRYX+AUTONOMOUS+INTELLIGENCE;INITIALIZING+AGENTIC+SWARM...;LOADING+GLASSMORPHIC+HUD..." alt="Typing SVG" />
</a>

<p align="center">
  <img src="https://img.shields.io/badge/ELECTRON-191970?style=for-the-badge&logo=Electron&logoColor=00E5FF&labelColor=111111" />
  <img src="https://img.shields.io/badge/REACT_18-20232A?style=for-the-badge&logo=react&logoColor=00E5FF&labelColor=111111" />
  <img src="https://img.shields.io/badge/ZUSTAND-443E38?style=for-the-badge&logo=React&logoColor=10B981&labelColor=111111" />
  <img src="https://img.shields.io/badge/FASTAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=10B981&labelColor=111111" />
  <img src="https://img.shields.io/badge/WEBSOCKETS-010101?style=for-the-badge&logo=socket.io&logoColor=A855F7&labelColor=111111" />
  <img src="https://img.shields.io/badge/PYTHON_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=A855F7&labelColor=111111" />
</p>

---

<table align="center" width="100%">
  <tr>
    <td align="center" width="50%">
      <b>[ CORE DIRECTIVE ]</b><br><br>
      Astryx is a hyper-optimized, bidirectional, zero-latency local AI operating environment. It bypasses standard conversational wrapper interfaces to provide direct OS-level automation, spatial tracking, and multi-agent heuristic swarms within a dynamic glassmorphism HUD.
    </td>
    <td align="center" width="50%">
      <b>[ SYSTEM TELEMETRY ]</b><br><br>
      Latency: <code>< 15ms</code><br>
      State Sync: <code>Zustand + WebSocket</code><br>
      Memory: <code>ChromaDB + SQLite</code><br>
      Audio: <code>Edge-TTS + PyAudio VAD</code>
    </td>
  </tr>
</table>

</div>

---

## ╔═════════════════════════════════════════════════════════════════════════╗
## ║ 1. ARCHITECTURE & IMPLEMENTATION DETAILS                                  ║
## ╚═════════════════════════════════════════════════════════════════════════╝

The codebase is split into two massive concurrent systems that communicate entirely via async streams.

### `[ FRONTEND ]` The Glassmorphic HUD (React + Electron)
Unlike generic web apps, Astryx runs in an isolated Electron Chromium sandbox with a custom `framer-motion` engine handling all visual physics.
- **State Management (`jarvis.store.ts`)**: We do not use React Context. A single, monolithic Zustand store manages over 50 global variables (Orb states, websocket buffers, file tree nodes, theme hex codes). This allows deep components like the `BottomBar` to update independently without triggering app-wide re-renders.
- **The AI Orb Engine**: The central glowing orb uses complex SVG displacement maps (`<feTurbulence>`) mapped to the `orbState` variable. When the backend fires a `speaking` event, the turbulence frequency spikes to simulate vocal vibrations.
- **Dynamic CSS Injection**: Themes are swapped instantaneously by injecting native CSS variables (`--color-astryx-cyan`, etc.) directly into the `:root` pseudo-class.

### `[ BACKEND ]` The Agentic Core (FastAPI + WebSockets)
Built for pure concurrency and local execution.
- **Zero-Latency Bridge (`websockets.py`)**: HTTP REST is abandoned for continuous tasks. WebSockets stream JSON payloads back and forth. If you ask a coding question, the LLM tokens are yielded instantly into the UI's terminal feed before the sentence is even finished.
- **Memory Subsystems (`memory.py`)**: Employs **ChromaDB** for vector embeddings (RAG) to remember past conversations, and **SQLite** for structured telemetry (Health trackers, Finance, To-Do lists).
- **Voice Engine (`voice_engine.py`)**: Uses `faster-whisper` running locally for instantaneous Speech-to-Text, and hooks into a custom Voice Activity Detection (VAD) pipeline to know exactly when you start and stop talking, overriding the mic buffer dynamically.

---

## ╔═════════════════════════════════════════════════════════════════════════╗
## ║ 2. THE INTELLIGENCE MATRIX (MAIN FEATURES)                                ║
## ╚═════════════════════════════════════════════════════════════════════════╝

Astryx contains a registry of autonomous tools designed to execute desktop-level tasks.

<table width="100%">
  <tr>
    <td width="5%">📐</td>
    <td width="20%"><b>Spatial Wall Mapper</b></td>
    <td>Hooks into <code>navigator.mediaDevices</code> to project an Augmented Reality neon grid over the camera feed, simulating LiDAR spatial scanning to map room bounds.</td>
  </tr>
  <tr>
    <td width="5%">💻</td>
    <td width="20%"><b>Antigravity IDE</b></td>
    <td>A fully functioning sub-window executing multi-agent coding. LLMs draft code in Python/TypeScript, execute it in an isolated shell, capture <code>stderr</code>, and self-correct errors autonomously.</td>
  </tr>
  <tr>
    <td width="5%">📝</td>
    <td width="20%"><b>Live Audio Tracker</b></td>
    <td>Intercepts system audio or microphone streams, visually maps the buffer to a sine-wave canvas, and auto-generates Markdown notes and summaries in real-time.</td>
  </tr>
  <tr>
    <td width="5%">📊</td>
    <td width="20%"><b>PPT Designer (COM)</b></td>
    <td>Uses Python's <code>win32com.client</code> to hijack the Microsoft PowerPoint executable, drawing custom ultra-premium slides (Quantum Flux, Obsidian) using OLE Automation bypassing human input.</td>
  </tr>
  <tr>
    <td width="5%">📡</td>
    <td width="20%"><b>Radar Scanner</b></td>
    <td>A real-time sweeping radar UI mapping out local network topologies and system vulnerabilities.</td>
  </tr>
</table>

---

## ╔═════════════════════════════════════════════════════════════════════════╗
## ║ 3. DYNAMIC UI THEMING ENGINE                                              ║
## ╚═════════════════════════════════════════════════════════════════════════╝

The UI is built on a highly custom glassmorphism aesthetic. No generic Tailwind templates were used; everything is custom vanilla CSS utilizing `backdrop-filter: blur(20px)` and intense hex glows.

| Theme Protocol | Hex Core | Designation |
| :--- | :---: | :--- |
| **CYAN** | `![#00e5ff](https://placehold.co/15x15/00e5ff/00e5ff.png)` `#00E5FF` | Default Intelligence |
| **STEALTH** | `![#111111](https://placehold.co/15x15/111111/111111.png)` `#111111` | Obsidian / Covert Operations |
| **EMERALD** | `![#10b981](https://placehold.co/15x15/10b981/10b981.png)` `#10B981` | Matrix / System Monitoring |
| **EMBER** | `![#f59e0b](https://placehold.co/15x15/f59e0b/f59e0b.png)` `#F59E0B` | Overclocked / Alert |
| **VIOLET** | `![#a855f7](https://placehold.co/15x15/a855f7/a855f7.png)` `#A855F7` | Neural Network / Creative |

---

## ╔═════════════════════════════════════════════════════════════════════════╗
## ║ 4. INITIALIZATION PROTOCOL (INSTALLATION)                                 ║
## ╚═════════════════════════════════════════════════════════════════════════╝

```powershell
# [1] ESTABLISH LOCAL REPOSITORY
git clone https://github.com/Allen73737/astryx-ai-assistant.git
cd astryx-ai-assistant

# [2] CONFIGURE ENVIRONMENT SECRETS
# Copy backend/.env.example to backend/.env and inject API credentials.
# Note: Pydantic natively loads these into the memory buffer at runtime via JARVIS_ prefixes.

# [3] INITIALIZE FRONTEND (ELECTRON/VITE)
npm install
npm run dev

# [4] INITIALIZE BACKEND (FASTAPI/PYTHON)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

<div align="center">
  <br>
  <img src="https://capsule-render.vercel.app/api?type=waving&color=10b981&height=100&section=footer" />
  <p><code>EOF // ASTRYX SYSTEM READY</code></p>
</div>
