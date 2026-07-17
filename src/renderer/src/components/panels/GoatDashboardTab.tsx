import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '@/utils/AudioEngine'

/* ═══════════════════ TYPES & ENUMS ═══════════════════ */

type FeatureCategory = 'sports' | 'swarm' | 'system' | 'creative' | 'utility'

interface AutonomousFeature {
  id: string
  name: string
  icon: string
  category: FeatureCategory
  status: 'ACTIVE' | 'SWARMING' | 'MONITORING' | 'SECURE' | 'IDLE' | 'OPTIMIZED'
  color: string
  description: string
  telemetry: string[]
}

const FEATURE_CATEGORIES: Record<FeatureCategory, { name: string; icon: string; color: string }> = {
  sports: { name: 'Sports Analytics', icon: '⚽', color: '#00e5ff' },
  swarm: { name: 'AI Swarm Agents', icon: '🤖', color: '#a855f7' },
  system: { name: 'System Diagnostics', icon: '⚙️', color: '#10b981' },
  creative: { name: 'Creative Engines', icon: '🎨', color: '#f43f5e' },
  utility: { name: 'Utility & Tools', icon: '🛠️', color: '#eab308' }
}

/* ═══════════════════ 100 AUTONOMOUS FEATURES DEFINITION ═══════════════════ */

const INITIAL_FEATURES: AutonomousFeature[] = [
  // --- Category: Sports Analytics (1-20) ---
  { id: 'f1', name: 'CR7 Goal Ticker', icon: '⚽', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Simulates live goals and match events for Cristiano Ronaldo worldwide.', telemetry: ['Initializing SPL database...', 'Goal count confirmed at 915+ career goals.'] },
  { id: 'f2', name: 'Leap Physics Engine', icon: '🦘', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Calculates vertical heights (2.93m) with real-time launch telemetry.', telemetry: ['Calibrating launch velocity: 9.1 m/s...', 'Jump height set to 2.93 meters.'] },
  { id: 'f3', name: 'Clutch Index Predictor', icon: '⏱️', category: 'sports', status: 'OPTIMIZED', color: '#00e5ff', description: 'Calculates high-pressure goal success rates in the 90th+ minute.', telemetry: ['Analyzing career clutch statistics...', 'Clutch Index confirmed at 100/100.'] },
  { id: 'f4', name: 'UCL Record Collector', icon: '🏆', category: 'sports', status: 'MONITORING', color: '#00e5ff', description: 'Tracks UEFA Champions League milestones (140+ goals, 5 titles).', telemetry: ['Scanning UEFA database...', 'All-time top scorer validated: CR7.'] },
  { id: 'f5', name: 'Al-Nassr Telemetry Map', icon: '🇸🇦', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Aggregates current club performance, heatmaps, and assist charts.', telemetry: ['SPL match tracker online...', 'Heatmap aggregation: active.'] },
  { id: 'f6', name: 'Ballon d\'Or Collector', icon: '👑', category: 'sports', status: 'MONITORING', color: '#00e5ff', description: 'Chronicles the 5 Golden Balls and associated points metrics.', telemetry: ['Retrieving historical award data...', 'Points indexed for years: 2008-2017.'] },
  { id: 'f7', name: 'Career Path Tracker', icon: '🗺️', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Interactive map and timeline from Sporting CP to Al-Nassr.', telemetry: ['Mapping coordinates: Lisbon -> Manchester -> Madrid -> Turin -> Riyadh.'] },
  { id: 'f8', name: 'Free-kick Knuckleballer', icon: '☄️', category: 'sports', status: 'OPTIMIZED', color: '#00e5ff', description: 'Simulates fluid dynamics and air drag of the knuckling ball.', telemetry: ['Calibrating wind speed...', 'Reynold\'s number calculations active.'] },
  { id: 'f9', name: 'Diet & Protein Log', icon: '🥩', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Generates CR7 elite diet profiles with 6 daily high-protein meals.', telemetry: ['Analyzing body fat index: target 7%.', 'Water intake target: 3.5L.'] },
  { id: 'f10', name: 'Workout Routine Monitor', icon: '🏋️', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Monitors pilates, core training, cold plunges, and sleep cycles.', telemetry: ['Recovery routine active.', 'Cryotherapy tank temperature: -130°C.'] },
  { id: 'f11', name: 'Ballon d\'Or Forecast', icon: '🔮', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Calculates upcoming season probabilities based on current SPL goal ratios.', telemetry: ['Analyzing historical voter parameters...', 'Current forecast: 95.8% top 3.'] },
  { id: 'f12', name: 'Portugal Cap Counter', icon: '🇵🇹', category: 'sports', status: 'MONITORING', color: '#00e5ff', description: 'Tracks Portugal caps (215+) and UEFA Euro qualifying match goals.', telemetry: ['Federation stats verified.', 'Caps total: 215. Goals total: 135.'] },
  { id: 'f13', name: 'El Clasico DB', icon: '⚔️', category: 'sports', status: 'SECURE', color: '#00e5ff', description: 'Scans all Real Madrid vs Barcelona derby goals and points margins.', telemetry: ['El Clasico goal ledger loaded.', 'CR7 derby total: 18 goals.'] },
  { id: 'f14', name: 'Serie A Scudetto Log', icon: '🇮🇹', category: 'sports', status: 'MONITORING', color: '#00e5ff', description: 'Aggregates statistics from his Juventus years, Scudettos, and Coppa Italia.', telemetry: ['Juventus stats verified.', '101 goals in 134 appearances.'] },
  { id: 'f15', name: 'Sporting CP Academy Map', icon: '🟢', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Visualizes early youth milestones at Alcochete and first-team debut.', telemetry: ['Academy records synced.', 'Sporting debut: August 14, 2002.'] },
  { id: 'f16', name: 'Penalty Ratio Meter', icon: '🎯', category: 'sports', status: 'OPTIMIZED', color: '#00e5ff', description: 'Calculates career penalty kick conversion success statistics.', telemetry: ['Evaluating 160+ penalties...', 'Success rate: 86.8% (Elite).'] },
  { id: 'f17', name: 'Sprint Velocity Tracker', icon: '🏃', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Monitors peak sprint speeds (up to 38.6 km/h) against defenders.', telemetry: ['Calibrating wind speed...', 'Peak recorded velocity: 38.6 km/h.'] },
  { id: 'f18', name: 'Ball Spin Aerodynamics', icon: '🌀', category: 'sports', status: 'MONITORING', color: '#00e5ff', description: 'Charts aerodynamic lift and Magnus force vectors of shots.', telemetry: ['Reading high-speed cameras...', 'Magnus force constant: 0.12 N.'] },
  { id: 'f19', name: 'Golden Boot Predictor', icon: '🥾', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Tracks career golden boots (4) and forecasts league top-scorer awards.', telemetry: ['League comparison matrix loaded.', 'Current SPL lead: 6 goals.'] },
  { id: 'f20', name: 'Pitch Heatmap V2', icon: '🗺️', category: 'sports', status: 'ACTIVE', color: '#00e5ff', description: 'Generates active offensive zone heatmaps for custom SPL match records.', telemetry: ['Plotting coordinates...', 'Left wing dominance verified.'] },

  // --- Category: AI Swarm Agents (21-40) ---
  { id: 'f21', name: 'Autonomous Code Swarm', icon: '🤖', category: 'swarm', status: 'SWARMING', color: '#a855f7', description: 'Orchestrates 8 parallel agents scanning files for optimization.', telemetry: ['Spawning Code agent...', 'Running syntax checker...'] },
  { id: 'f22', name: 'Vector Memory DB', icon: '🗄️', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Performs semantic searches over short and long-term agent memories.', telemetry: ['Connecting vector storage...', 'Latency: 4ms.'] },
  { id: 'f23', name: 'Thought Chain Map', icon: '💭', category: 'swarm', status: 'SWARMING', color: '#a855f7', description: 'Displays the internal monologue, reasoning trees, and self-corrections.', telemetry: ['Reasoning level: 3.', 'Validating outputs.'] },
  { id: 'f24', name: 'Security Threat Sweeper', icon: '📡', category: 'swarm', status: 'MONITORING', color: '#a855f7', description: 'Autonomous security sweeps checking for intrusion attempts.', telemetry: ['Scanning port allocations...', 'Zero threats found.'] },
  { id: 'f25', name: 'Proactive Alert Brain', icon: '💡', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Autonomously flags system spikes, calendar alerts, and news trends.', telemetry: ['Monitoring background task states...', 'Queue: Clear.'] },
  { id: 'f26', name: 'Vader Sentiment Analyzer', icon: '🎭', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Tracks user emotion and tones to dynamically modify responses.', telemetry: ['User score: 0.85 (Very Positive).'] },
  { id: 'f27', name: 'Dynamic LLM Router', icon: '𔔀', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Routes coding tasks to Groq/Qwen coding and chat to mixtral.', telemetry: ['Active model: Groq-Llama3.'] },
  { id: 'f28', name: 'Prompt Inject Shield', icon: '🛡️', category: 'swarm', status: 'SECURE', color: '#a855f7', description: 'Blocks malicious override instructions and registers security logs.', telemetry: ['Scanning request input...', 'Shield: maximum.'] },
  { id: 'f29', name: 'Inference Speed Meter', icon: '⏱️', category: 'swarm', status: 'MONITORING', color: '#a855f7', description: 'Charts time-to-first-token and stream generation speeds.', telemetry: ['TTFT: 140ms.', 'Speed: 65.2 tokens/sec.'] },
  { id: 'f30', name: 'Swarm Forge Sandbox', icon: '👾', category: 'swarm', status: 'IDLE', color: '#a855f7', description: 'Launcher for collaborative multi-agent simulation sandboxes.', telemetry: ['Forge: Standby.', 'Ready to deploy 25+ agents.'] },
  { id: 'f31', name: 'Multi-Agent Arena', icon: '🤼', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Spawns optimistic and skeptical agents to debate questions.', telemetry: ['Arena populated.', 'Agent count: 4. Rounds: 2.'] },
  { id: 'f32', name: 'Strategic AlphaGo Node', icon: '🌐', category: 'swarm', status: 'IDLE', color: '#a855f7', description: 'Runs Monte Carlo tree searches to suggest moves for board games.', telemetry: ['MCTS database online.', 'Ready to evaluate paths.'] },
  { id: 'f33', name: 'Self-Improving Coder', icon: '🧬', category: 'swarm', status: 'SWARMING', color: '#a855f7', description: 'Autonomously writes unit tests and fixes lints on its own code.', telemetry: ['Running lint on test file...', 'Fix applied successfully.'] },
  { id: 'f34', name: 'Memory Graph Pruner', icon: '✂️', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Optimizes long-term memory graph database nodes to save storage.', telemetry: ['Graph density checked.', 'Pruned 15 redundant links.'] },
  { id: 'f35', name: 'Intrusion Guard V2', icon: '💂', category: 'swarm', status: 'SECURE', color: '#a855f7', description: 'Monitors real-time file systems for root permission alterations.', telemetry: ['Watching system logs...', 'File integrity verified.'] },
  { id: 'f36', name: 'Tone Adaptor Module', icon: '🗣️', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Dynamically adapts vocabulary complexity to match user requests.', telemetry: ['Calibrating complexity...', 'Setting: advanced developer.'] },
  { id: 'f37', name: 'Load Balancer Node', icon: '⚖️', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Distributes API tasks across 4 Groq endpoints to maximize speed.', telemetry: ['Active API slots: 4/4.', 'Load: 25% each.'] },
  { id: 'f38', name: 'Jailbreak Prevention', icon: '🚷', category: 'swarm', status: 'SECURE', color: '#a855f7', description: 'Applies adversarial filters to all user inputs to block bypass hacks.', telemetry: ['Filters initialized.', 'Integrity: verified.'] },
  { id: 'f39', name: 'Semantic Embed Graph', icon: '📊', category: 'swarm', status: 'ACTIVE', color: '#a855f7', description: 'Visualizes vector embeddings cluster graphs in real-time.', telemetry: ['Rendering dimensions...', 'Clusters identified: 8.'] },
  { id: 'f40', name: 'Agent Core Console', icon: '🎮', category: 'swarm', status: 'IDLE', color: '#a855f7', description: 'Main orchestration dashboard for active background agents.', telemetry: ['System ready.', 'Ready to monitor agents.'] },

  // --- Category: System Diagnostics (41-60) ---
  { id: 'f41', name: 'CPU Core Visualizer', icon: '💻', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Charts usage percentages for all logical processor cores.', telemetry: ['Core 1: 12% | Core 2: 8% | Core 3: 15% | Core 4: 5%'] },
  { id: 'f42', name: 'Disk IO Sweeper', icon: '💽', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Displays active read/write speed indicators for drives.', telemetry: ['Read: 2.1 MB/s.', 'Write: 0.4 MB/s.'] },
  { id: 'f43', name: 'Network Packets sweep', icon: '🌐', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Logs download speeds and network interface packet drops.', telemetry: ['Ethernet interface active...', 'Packet loss rate: 0.00%.'] },
  { id: 'f44', name: 'Process Manager Core', icon: '🔪', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Monitors background processes and allows forced terminations.', telemetry: ['Scanning process trees...', 'Total active tasks: 122.'] },
  { id: 'f45', name: 'Cyberdeck Port Scanner', icon: '🚪', category: 'system', status: 'SECURE', color: '#10b981', description: 'Checks port assignments and locks unauthorized sockets.', telemetry: ['Scanning sockets...', 'Local active: 8002, 8080.'] },
  { id: 'f46', name: 'Docker Container Deck', icon: '🐳', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Displays status and memory footprints of running containers.', telemetry: ['Containers: 2 running.', 'Memory utilized: 280MB.'] },
  { id: 'f47', name: 'Git Swarm Syncer', icon: '🐙', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Auto-commits and pushes code updates to remote repositories.', telemetry: ['Repository clean.', 'Ahead of origin by 0 commits.'] },
  { id: 'f48', name: 'Live Log Streamer', icon: '📝', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Aggregates outputs from the Python backend and Electron window.', telemetry: ['Connecting logs...', 'Listening for errors...'] },
  { id: 'f49', name: 'Core Temp Monitor', icon: '🌡️', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Monitors CPU, GPU, and motherboard thermal profiles.', telemetry: ['CPU: 48°C | GPU: 52°C.'] },
  { id: 'f50', name: 'Wi-Fi Traffic Monitor', icon: '📶', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Measures signal strength and wireless channel interference.', telemetry: ['Signal: 98% | Band: 5GHz.'] },
  { id: 'f51', name: 'Overclock Sweeper', icon: '🔥', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Safely controls and flushes thermal throttles under high load.', telemetry: ['Core frequency: 4.2GHz.', 'Status: Normal.'] },
  { id: 'f52', name: 'SSD NVMe IOPS Detector', icon: '⚡', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Measures read/write operations per second to catch bottlenecks.', telemetry: ['Drive health: 99%.', 'IOPS rate: 42,000/sec.'] },
  { id: 'f53', name: 'RAM Cache Flush Node', icon: '🧹', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Frees up standby memory space automatically when idle.', telemetry: ['Flushing cached files...', 'Freed 1.2GB RAM.'] },
  { id: 'f54', name: 'Heap Memory Inspector', icon: '🔬', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Scans the JavaScript V8 engine memory heap for leak sources.', telemetry: ['Indexed objects: 154,000.', 'Leak status: None.'] },
  { id: 'f55', name: 'Port Sockets Lock', icon: '🔒', category: 'system', status: 'SECURE', color: '#10b981', description: 'Enforces socket firewall filters for incoming websocket requests.', telemetry: ['Firewall active.', 'Unauthorized connections: 0.'] },
  { id: 'f56', name: 'Kubernetes Cluster Deck', icon: '☸️', category: 'system', status: 'IDLE', color: '#10b981', description: 'Simple visual manager for local minikube container pods.', telemetry: ['Kubernetes pods: 0.', 'Deck state: Standby.'] },
  { id: 'f57', name: 'Git Conflict Solver', icon: '🔀', category: 'system', status: 'OPTIMIZED', color: '#10b981', description: 'Scans merge conflicts and recommends resolution commits.', telemetry: ['Git scanner active.', 'No merge conflicts.'] },
  { id: 'f58', name: 'Node Process Stream', icon: '💹', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Tracks CPU thread allocation of sub-process exec operations.', telemetry: ['Watching child processes...', 'Active worker threads: 2.'] },
  { id: 'f59', name: 'GPU CUDA Core Monitor', icon: '📟', category: 'system', status: 'MONITORING', color: '#10b981', description: 'Tracks graphical acceleration load and VRAM allocations.', telemetry: ['VRAM load: 2.5GB / 8.0GB.', 'Core usage: 10%.'] },
  { id: 'f60', name: 'Bandwidth Shaper', icon: '✈️', category: 'system', status: 'ACTIVE', color: '#10b981', description: 'Regulates WebSocket data packet frequencies to lower latency.', telemetry: ['Packet queue optimizer active.', 'Latency limit: 50ms.'] },

  // --- Category: Creative Engines (61-80) ---
  { id: 'f61', name: 'Dreamscape Canvas', icon: '🌌', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Dynamic canvas neural art generator based on system noise.', telemetry: ['Canvas refresh at 60fps active.'] },
  { id: 'f62', name: 'Spectral Wave Equalizer', icon: '🎵', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Procedural sound wave visualizer responding to mic inputs.', telemetry: ['Bin count: 256. Acoustic sweep online.'] },
  { id: 'f63', name: 'Synthwave Soundboard', icon: '🎛️', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: '80s synth pad engine with retro-futuristic sound effects.', telemetry: ['Waveform: Sawtooth. Cutoff: 850Hz.'] },
  { id: 'f64', name: 'Celestial Starmap Nav', icon: '⭐', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: '3D mathematical constellation mapping and star explorer.', telemetry: ['Plotting Orion Nebula coordinates...'] },
  { id: 'f65', name: 'SVG Prompt Generator', icon: '🖼️', category: 'creative', status: 'IDLE', color: '#f43f5e', description: 'Generates SVG and digital artwork directly from prompt strings.', telemetry: ['Output mode: High-definition SVG vector.'] },
  { id: 'f66', name: 'AI Source Reviewer', icon: '🧠', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Generates line-by-line analyses of scripts and languages.', telemetry: ['Supported: Python, TS, Rust.'] },
  { id: 'f67', name: 'Language Translator', icon: '🌐', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Performs multi-language translations and logs word roots.', telemetry: ['English to Spanish/Malayalam/Chinese: Ready.'] },
  { id: 'f68', name: 'Cinematic Slides Maker', icon: '📊', category: 'creative', status: 'IDLE', color: '#f43f5e', description: 'Generates design coordinates for presentations automatically.', telemetry: ['Ready to export design systems.'] },
  { id: 'f69', name: 'Newsletter Composer', icon: '📰', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Scrapes web and outputs clean, daily summarized reports.', telemetry: ['Scraping headlines...', 'Template loaded.'] },
  { id: 'f70', name: 'Markdown Live Renderer', icon: '📝', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Converts raw Markdown texts into premium styled DOM layouts.', telemetry: ['Syntax tables and code highlighting: Ready.'] },
  { id: 'f71', name: 'Neural Mesh Generator', icon: '🕸️', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Calculates mathematical vector mesh coordinates dynamically.', telemetry: ['Mesh vertices: 512.', 'FPS: 60.'] },
  { id: 'f72', name: 'Sound Synth Wavemaker', icon: '🎻', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Procedural music synthesizer generating soundscapes.', telemetry: ['Tone generator active.', 'Wave: Triangle.'] },
  { id: 'f73', name: '80s Drum Machine Deck', icon: '🥁', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Interactive drum synthesizer with retro pattern logs.', telemetry: ['BPM: 120.', 'Patterns loaded: 4.'] },
  { id: 'f74', name: 'Constellation Navigator', icon: '🔭', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Maps star locations using celestial equations.', telemetry: ['Plotting coordinates: Ursa Major.', 'Azimuth: 12.4°.'] },
  { id: 'f75', name: 'Vector Art Renderer', icon: '🎨', category: 'creative', status: 'IDLE', color: '#f43f5e', description: 'Renders custom abstract shape compositions from text.', telemetry: ['Canvas initialized.', 'SVG compiler ready.'] },
  { id: 'f76', name: 'AI Source Explainer V2', icon: '📖', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Analyzes algorithmic structures in files.', telemetry: ['File parsing active.', 'AST nodes index: 2100.'] },
  { id: 'f77', name: 'Speech Language Bridge', icon: '🎙️', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Detects spoken language and redirects TTS output feeds.', telemetry: ['Speech input ready.', 'Routing: ml-IN Midhun Neural.'] },
  { id: 'f78', name: 'PPT Template Designer', icon: '🎨', category: 'creative', status: 'IDLE', color: '#f43f5e', description: 'Designs cinematic slide themes using professional HSL palettes.', telemetry: ['Theme generator: standby.', 'Palette: Obsidian & Cyan.'] },
  { id: 'f79', name: 'Smart RSS News Writer', icon: '📰', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Writes editorial summaries from news RSS feeds.', telemetry: ['Scanning feeds...', 'Headline count: 12.'] },
  { id: 'f80', name: 'Markdown Editor Parser', icon: '🖋️', category: 'creative', status: 'ACTIVE', color: '#f43f5e', description: 'Validates GitHub flavored markdown tags live.', telemetry: ['Tags checked.', 'Lint parser: OK.'] },

  // --- Category: Utility & Tools (81-100) ---
  { id: 'f81', name: 'Weather Station', icon: '🌤️', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Live atmospheric weather tracker with wind pressure gauges.', telemetry: ['Temp: 28°C | Humidity: 65%.'] },
  { id: 'f82', name: 'Financial Stock Ticker', icon: '📈', category: 'utility', status: 'MONITORING', color: '#eab308', description: 'LED-styled stock prices ticker showing candlestick graphs.', telemetry: ['TSLA: $250.45 (+1.2%)'] },
  { id: 'f83', name: 'Particle Physics Sandbox', icon: '🧪', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Gravity physics box simulating particle collisions on click.', telemetry: ['Particle count: 120. Collisions: Enabled.'] },
  { id: 'f84', name: 'Code Minifier Tool', icon: '🗜️', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Compresses scripts and calculates byte savings gauges.', telemetry: ['Method: AST spacing compiler.'] },
  { id: 'f85', name: 'RPG Quest Logbook', icon: '🎮', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Tracks system achievement logs and game-like coding points.', telemetry: ['Points: 14,250 XP. Quest: complete CR7 GOAT panel.'] },
  { id: 'f86', name: 'Command Timeline', icon: '📜', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'A timeline history of all terminal commands and operations.', telemetry: ['Total entries logged: 420.'] },
  { id: 'f87', name: 'Crypto Portfolio Tracker', icon: '🪙', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Real-time cryptocurrency index and budget optimizer.', telemetry: ['BTC: $98,420. Portfolio value updated.'] },
  { id: 'f88', name: 'Hydration & Water Logs', icon: '🏥', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Logs water intakes, sports exercises, and calorie budgets.', telemetry: ['Intake: 2000ml. Calories: 520 kcal.'] },
  { id: 'f89', name: 'Drone Flight Telemetry', icon: '🚁', category: 'utility', status: 'IDLE', color: '#eab308', description: 'Flight simulation interface monitoring hover height and speed.', telemetry: ['Drone core link: Standby.'] },
  { id: 'f90', name: 'Alarm & Cron Scheduler', icon: '⏰', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Manages recurring scripts and one-shot background alerts.', telemetry: ['Cron active: every 15m CPU check.'] },
  { id: 'f91', name: 'Weather Satellite Map', icon: '🗺️', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Loads clouds visual overlays from national radar feeds.', telemetry: ['Connecting to satellite map...', 'Data sync: complete.'] },
  { id: 'f92', name: 'High-Frequency Ticker', icon: '📊', category: 'utility', status: 'MONITORING', color: '#eab308', description: 'Simulates micro-second trades and graphs candlestick pricing.', telemetry: ['Trade volume: 50,000/min.', 'Bid/Ask Spread: $0.02.'] },
  { id: 'f93', name: 'Quantum Collision Sandbox', icon: '⚛️', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Collides quarks and tracks trace decay strings on screen.', telemetry: ['Sub-atomic collision engine online.', 'Decayed strings: 42.'] },
  { id: 'f94', name: 'Brotli/Gzip Compactor', icon: '📦', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Compresses payload strings and estimates bandwidth speeds.', telemetry: ['Compression level: 9.', 'Byte savings: 74.2%.'] },
  { id: 'f95', name: 'Retro Quest Logs Deck', icon: '🕹️', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Displays quest items, badges, and retro status metrics.', telemetry: ['Quest status: active.', 'Badges: 8/10.'] },
  { id: 'f96', name: 'Command Scroll Deck', icon: '📜', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Lists all CLI command triggers from the assistant.', telemetry: ['Command history fetched.', 'Total entries: 420.'] },
  { id: 'f97', name: 'DeFi Token Swap Analyzer', icon: '💱', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Scans arbitrage pathways across decentralized exchanges.', telemetry: ['Spread: 0.12%. Arbitrage opportunity: None.'] },
  { id: 'f98', name: 'Workout Routine Logger', icon: '💪', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Logs strength training reps and calculates rest limits.', telemetry: ['Workout logged: Upper body.', 'Rest timer: 90s.'] },
  { id: 'f99', name: 'Drone Flight Navigator', icon: '🛰️', category: 'utility', status: 'IDLE', color: '#eab308', description: 'Interactive path editor for simulated drone coordinates.', telemetry: ['Target coordinates loaded.', 'Path: waypoint A to B.'] },
  { id: 'f100', name: 'Alarm Scheduler Deck', icon: '📅', category: 'utility', status: 'ACTIVE', color: '#eab308', description: 'Lists active cron commands and schedules one-shot alerts.', telemetry: ['Next task: Backup databases at 00:00.', 'Alarms: 0 active.'] }
]

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export function GoatDashboardTab(): React.JSX.Element {
  const [features, setFeatures] = useState<AutonomousFeature[]>(INITIAL_FEATURES)
  const [selectedCategory, setSelectedCategory] = useState<'all' | FeatureCategory>('all')
  const [activeSubTool, setActiveSubTool] = useState<AutonomousFeature | null>(null)
  const [search, setSearch] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState(false)

  // Beast Mode State
  const [beastMode, setBeastMode] = useState(false)

  // CR7 Dynamic values
  const [goals, setGoals] = useState(915)
  const [jumpHeight, setJumpHeight] = useState(2.93)
  const [isJumping, setIsJumping] = useState(false)
  
  // Leap physics readout
  const [leapReadout, setLeapReadout] = useState({ speed: '0.00 m/s', energy: '0 Joules', gForce: '1.0G' })

  // Simulation log terminal
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null)

  // Auto-scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalLogs])

  // Matrix Background Effect
  useEffect(() => {
    const canvas = matrixCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.parentElement?.clientWidth || 300
    canvas.height = 160

    const columns = Math.floor(canvas.width / 12)
    const drops: number[] = Array(columns).fill(0)
    const alphabet = 'CR7GOAT915⚽🇵🇹🏆'

    const drawMatrix = () => {
      ctx.fillStyle = 'rgba(0, 5, 13, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = beastMode ? 'rgba(244, 63, 94, 0.45)' : 'rgba(0, 229, 255, 0.35)'
      ctx.font = '8px monospace'

      for (let i = 0; i < drops.length; i++) {
        const text = alphabet[Math.floor(Math.random() * alphabet.length)]
        ctx.fillText(text, i * 12, drops[i] * 12)

        if (drops[i] * 12 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(drawMatrix, 40)
    return () => clearInterval(interval)
  }, [beastMode])

  // Canvas Physics Leap Animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let frame = 0
    let startY = 120
    let currentY = startY
    let peakY = startY - (jumpHeight * 30) // 30px per meter
    let jumping = isJumping

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw ground
      ctx.strokeStyle = beastMode ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(10, startY + 10)
      ctx.lineTo(210, startY + 10)
      ctx.stroke()

      // Height markings
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '7px Courier New'
      ctx.fillText('GROUND (0.00m)', 12, startY + 22)
      ctx.fillText(`${jumpHeight.toFixed(2)}m PEAK`, 120, Math.max(10, peakY - 10))

      // Draw peak line
      ctx.strokeStyle = beastMode ? 'rgba(244,63,94,0.5)' : 'rgba(0, 229, 255, 0.3)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(10, peakY)
      ctx.lineTo(210, peakY)
      ctx.stroke()
      ctx.setLineDash([])

      // Update jumping physics
      if (jumping) {
        frame += beastMode ? 0.06 : 0.04
        currentY = startY - Math.sin(frame * Math.PI) * (startY - peakY)
        
        // Calculate dynamic leap values
        const speed = (9.12 * Math.cos(frame * Math.PI)).toFixed(2)
        const energy = Math.floor(620 * Math.sin(frame * Math.PI))
        const gForce = (1.0 + 4.2 * Math.sin(frame * Math.PI)).toFixed(1)
        
        setLeapReadout({
          speed: `${speed} m/s`,
          energy: `${energy} Joules`,
          gForce: `${gForce}G`
        })

        if (frame >= 1) {
          jumping = false
          setIsJumping(false)
          currentY = startY
          setLeapReadout({ speed: '0.00 m/s', energy: '0 Joules', gForce: '1.0G (Land)' })
          audioEngine.playSuccess()
        }
      }

      // Draw CR7 stick figure jumping
      ctx.fillStyle = beastMode ? '#f43f5e' : '#00e5ff'
      ctx.shadowBlur = 10
      ctx.shadowColor = beastMode ? '#f43f5e' : '#00e5ff'

      // Head (Sphere)
      ctx.beginPath()
      ctx.arc(110, currentY - 25, 6, 0, Math.PI * 2)
      ctx.fill()

      // Jersey (7)
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#ffffff'
      ctx.font = 'bold 9px Rajdhani'
      ctx.fillText('7', 107, currentY - 10)

      // Body (Line)
      ctx.strokeStyle = beastMode ? '#f43f5e' : '#00e5ff'
      ctx.shadowColor = beastMode ? '#f43f5e' : '#00e5ff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(110, currentY - 19)
      ctx.lineTo(110, currentY)
      ctx.stroke()

      // Arms (Dynamic based on jump state)
      ctx.lineWidth = 2
      ctx.beginPath()
      if (jumping) {
        // Arms up in celebration/flight
        ctx.moveTo(110, currentY - 15)
        ctx.lineTo(95, currentY - 28)
        ctx.moveTo(110, currentY - 15)
        ctx.lineTo(125, currentY - 28)
      } else {
        ctx.moveTo(110, currentY - 15)
        ctx.lineTo(100, currentY)
        ctx.moveTo(110, currentY - 15)
        ctx.lineTo(120, currentY)
      }
      ctx.stroke()

      // Legs (Bending in leap)
      ctx.beginPath()
      if (jumping) {
        ctx.moveTo(110, currentY)
        ctx.lineTo(102, currentY + 12)
        ctx.lineTo(95, currentY + 8)

        ctx.moveTo(110, currentY)
        ctx.lineTo(118, currentY + 12)
        ctx.lineTo(125, currentY + 8)
      } else {
        ctx.moveTo(110, currentY)
        ctx.lineTo(102, currentY + 15)
        ctx.moveTo(110, currentY)
        ctx.lineTo(118, currentY + 15)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      animationId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationId)
  }, [jumpHeight, isJumping, beastMode])

  // Sync Live Data
  const triggerSync = () => {
    if (isSyncing) return
    audioEngine.playElevate()
    setIsSyncing(true)
    setSyncFlash(true)
    setTimeout(() => setSyncFlash(false), 200)

    const syncLogs = [
      '⚡ CONTACTING GLOBAL SPORTS ANALYTICS ORACLE...',
      '📡 CONNECTING TO SAUDI PRO LEAGUE FEED (RIYADH)...',
      '📡 CONNECTING TO UEFA HQ (NYON, SWITZERLAND)...',
      '🔄 PARSING RECENT MATCH DATA...',
      '✅ SYNC SUCCESSFUL. RECENT AL-NASSR GOALS DETECTED.',
      '⚽ CAREER TOTAL INCREMENTED: 915 -> 916 GOALS VERIFIED.'
    ]

    let logIdx = 0
    const logInterval = setInterval(() => {
      if (logIdx < syncLogs.length) {
        setTerminalLogs(prev => [...prev, syncLogs[logIdx]])
        logIdx++
      } else {
        clearInterval(logInterval)
        setGoals(916)
        setIsSyncing(false)
        audioEngine.playSuccess()
      }
    }, beastMode ? 300 : 600)
  }

  // Handle active subtool click
  const selectSubTool = (tool: AutonomousFeature) => {
    audioEngine.playClick()
    setActiveSubTool(tool)
    setTerminalLogs(tool.telemetry)

    // Simulate ticking live log outputs
    let tickCount = 0
    const tickInterval = setInterval(() => {
      if (tickCount < 3) {
        const extraLogs = [
          `📡 Telemetry broadcast // packet received [seq:${Math.floor(Math.random() * 1000)}]`,
          `⚙️ Checking subsystem state: OK // latency ${Math.floor(Math.random() * 15) + 3}ms`,
          `🟢 Autonomous thread [${tool.id}] heartbeat loop running.`
        ]
        setTerminalLogs(prev => [...prev, extraLogs[tickCount]])
        tickCount++
      } else {
        clearInterval(tickInterval)
      }
    }, beastMode ? 600 : 1200)
  }

  // Filter features
  const filtered = features.filter(f => {
    const categoryMatches = selectedCategory === 'all' || f.category === selectedCategory
    const searchMatches = f.name.toLowerCase().includes(search.toLowerCase()) || 
                          f.description.toLowerCase().includes(search.toLowerCase())
    return categoryMatches && searchMatches
  })

  // Theme styling helpers based on Beast Mode
  const activeColor = beastMode ? '#f43f5e' : '#00e5ff'
  const activeBorder = beastMode ? 'border-red-500/50 shadow-[0_0_15px_rgba(244,63,94,0.35)]' : 'border-[#00e5ff]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'

  return (
    <div className="h-full flex flex-col min-h-0 select-none relative bg-astryx-obsidian text-white text-[10px] font-mono leading-relaxed transition-all duration-700">
      
      {/* Full-HUD Scanner Flash Overlay */}
      <AnimatePresence>
        {syncFlash && (
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ backgroundColor: `${activeColor}30` }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Header Telemetry Band */}
      <div className="flex border-b border-white/10 p-3 items-center justify-between shrink-0 bg-transparent relative z-10 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] animate-pulse" style={{ color: activeColor }}>👑</span>
          <div>
            <h2 className="font-display font-semibold text-[11px] tracking-[0.2em] text-white">CR7 GOAT INTELLIGENCE DECK</h2>
            <p className="text-[7.5px] text-white/50 tracking-wider">100 AUTONOMOUS SWARM WIDGETS ONLINE</p>
          </div>
        </div>

        {/* Action Buttons Deck */}
        <div className="flex gap-2 items-center">
          {/* Beast Mode Toggle */}
          <button
            onClick={() => {
              audioEngine.playGearShift()
              setBeastMode(!beastMode)
            }}
            className={`px-3 py-1.5 rounded border font-bold tracking-widest text-[8px] transition-all cursor-pointer flex items-center gap-1.5 ${beastMode ? 'border-red-500 bg-red-950/40 text-red-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
          >
            <span>🔥</span>
            <span>BEAST MODE: {beastMode ? 'ACTIVE' : 'OFF'}</span>
          </button>

          {/* Sync Data Trigger */}
          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/15 hover:border-[#00e5ff]/50 bg-white/5 text-white hover:bg-white/10 font-semibold tracking-wider transition-all cursor-pointer text-[8px] ${isSyncing ? 'animate-pulse opacity-50' : ''}`}
            style={{ borderColor: isSyncing ? activeColor : undefined }}
          >
            <span>🔄</span>
            <span>{isSyncing ? 'SYNCING DATA...' : 'FORCE LIVE SYNC'}</span>
          </button>
        </div>
      </div>

      {/* Split view: Upper: CR7 Stats & Jump Physics | Lower: 100 Modules Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 no-scrollbar">
        
        {/* Upper Dashboard Widget Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          
          {/* Card 1: GOAT Telemetry Grid */}
          <div className="border border-white/10 rounded-lg p-3 bg-white/5 flex flex-col justify-between space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.3)] relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 relative z-10">
              <span className="text-[8px] tracking-widest font-bold" style={{ color: activeColor }}>CAREER RECORD METRICS</span>
              <span className="text-[7px] text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">VERIFIED</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5 relative z-10">
              <div className="bg-black/30 border border-white/5 p-2 rounded relative group hover:border-[#00e5ff]/30 transition-all">
                <span className="text-[7px] text-white/40 block">TOTAL GOALS</span>
                <span className="text-[15px] font-bold text-white font-display drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">{goals}</span>
                <span className="text-[6.5px] block mt-0.5 font-sans font-semibold" style={{ color: activeColor }}>Live SPL & Portugal</span>
              </div>
              <div className="bg-black/30 border border-white/5 p-2 rounded hover:border-[#00e5ff]/30 transition-all">
                <span className="text-[7px] text-white/40 block">INT. GOALS</span>
                <span className="text-[15px] font-bold font-display" style={{ color: activeColor }}>135</span>
                <span className="text-[6.5px] text-white/30 block mt-0.5">All-Time Record</span>
              </div>
              <div className="bg-black/30 border border-white/5 p-2 rounded hover:border-[#00e5ff]/30 transition-all">
                <span className="text-[7px] text-white/40 block">UCL GOALS</span>
                <span className="text-[15px] font-bold text-white font-display">140</span>
                <span className="text-[6.5px] text-white/30 block mt-0.5">Champions League #1</span>
              </div>
              <div className="bg-black/30 border border-white/5 p-2 rounded hover:border-[#00e5ff]/30 transition-all">
                <span className="text-[7px] text-white/40 block">BALLON D'OR</span>
                <span className="text-[15px] font-bold text-[#eab308] font-display">5</span>
                <span className="text-[6.5px] text-white/30 block mt-0.5">Golden Trophies</span>
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 p-2 rounded text-[7px] text-white/60 relative z-10">
              <span className="font-bold animate-pulse" style={{ color: activeColor }}>GOAT Stat:</span> Undisputed top scorer in UCL history, most international caps & goals ever.
            </div>
          </div>

          {/* Card 2: Physical Header Leap Simulator */}
          <div className="border border-white/10 rounded-lg p-3 bg-white/5 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[8px] tracking-widest font-bold" style={{ color: activeColor }}>LEAP PHYSICS TESTER</span>
              <span className="text-[7px] text-white/40">G-FORCE CALCULATOR</span>
            </div>

            <div className="flex gap-3 items-center justify-center py-1">
              <canvas ref={canvasRef} width={220} height={160} className="bg-black/50 rounded border border-white/5 w-[220px] h-[160px]" />
              
              <div className="flex-1 flex flex-col gap-2 justify-center">
                <div className="space-y-1 bg-black/40 p-2 rounded border border-white/5 text-[7px]">
                  <div className="flex justify-between"><span>VELOCITY:</span> <span className="text-white font-bold">{leapReadout.speed}</span></div>
                  <div className="flex justify-between"><span>ENERGY:</span> <span className="text-white font-bold">{leapReadout.energy}</span></div>
                  <div className="flex justify-between"><span>G-FORCE:</span> <span className="text-white font-bold" style={{ color: activeColor }}>{leapReadout.gForce}</span></div>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="1.50"
                    max="3.20"
                    step="0.05"
                    value={jumpHeight}
                    onChange={(e) => {
                      setJumpHeight(parseFloat(e.target.value))
                      audioEngine.playKeyboardTyping()
                    }}
                    className="w-full accent-white cursor-pointer"
                  />
                  <div className="flex justify-between text-[7px] text-white/40">
                    <span>1.5m</span>
                    <span className="font-bold" style={{ color: activeColor }}>{jumpHeight.toFixed(2)}m</span>
                    <span>3.2m</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    audioEngine.playGearShift()
                    setIsJumping(true)
                  }}
                  disabled={isJumping}
                  className="w-full py-1.5 rounded font-display font-bold tracking-widest text-black hover:opacity-90 active:scale-95 transition-all text-[8px] cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${activeColor}, #ffffff)` }}
                >
                  TEST JUMP LEAP
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Comparison Matrix overlayed with Matrix Streams */}
          <div className="border border-white/10 rounded-lg p-3 bg-white/5 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)] relative overflow-hidden">
            <canvas ref={matrixCanvasRef} className="absolute inset-0 pointer-events-none opacity-[0.15] z-0" />
            
            <div className="flex items-center justify-between border-b border-white/5 pb-2 relative z-10">
              <span className="text-[8px] tracking-widest font-bold" style={{ color: activeColor }}>MATRIX ATTR CORRELATION</span>
              <span className="text-[7px] text-white/40">CR7 vs MESSI RATIO</span>
            </div>

            <div className="space-y-2 py-1 relative z-10">
              {/* Stat 1: Clutch */}
              <div>
                <div className="flex justify-between text-[7.5px] text-white/60 mb-0.5">
                  <span>CLUTCH INDEX</span>
                  <span className="font-bold" style={{ color: activeColor }}>CR7: 100% | LM: 78%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden flex gap-1">
                  <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: activeColor }} />
                  <div className="h-full bg-white opacity-20 rounded-full" style={{ width: '78%' }} />
                </div>
              </div>

              {/* Stat 2: Longevity */}
              <div>
                <div className="flex justify-between text-[7.5px] text-white/60 mb-0.5">
                  <span>LONGEVITY / FITNESS</span>
                  <span className="font-bold" style={{ color: activeColor }}>CR7: 99% | LM: 81%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden flex gap-1">
                  <div className="h-full rounded-full" style={{ width: '99%', backgroundColor: activeColor }} />
                  <div className="h-full bg-white opacity-20 rounded-full" style={{ width: '81%' }} />
                </div>
              </div>

              {/* Stat 3: Headers & Leaps */}
              <div>
                <div className="flex justify-between text-[7.5px] text-white/60 mb-0.5">
                  <span>AERIAL / VERTICAL</span>
                  <span className="font-bold" style={{ color: activeColor }}>CR7: 99% | LM: 45%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden flex gap-1">
                  <div className="h-full rounded-full" style={{ width: '99%', backgroundColor: activeColor }} />
                  <div className="h-full bg-white opacity-20 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>

              {/* Stat 4: Int. Success */}
              <div>
                <div className="flex justify-between text-[7.5px] text-white/60 mb-0.5">
                  <span>INT. GOALS RECORD</span>
                  <span className="font-bold" style={{ color: activeColor }}>CR7: 135 | LM: 109</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden flex gap-1">
                  <div className="h-full rounded-full" style={{ width: '99%', backgroundColor: activeColor }} />
                  <div className="h-full bg-white opacity-20 rounded-full" style={{ width: '80%' }} />
                </div>
              </div>
            </div>

            <div className="text-[6.5px] text-white/45 italic text-center pt-1 border-t border-white/5 relative z-10">
              *All stats retrieved via live sport feeds verified for calendar year 2026.
            </div>
          </div>

        </div>

        {/* Categories Bar & Search Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-t border-white/10 pt-3 relative z-10">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => { audioEngine.playClick(); setSelectedCategory('all') }}
              className={`px-3 py-1.5 rounded-full text-[7.5px] font-mono border transition-all cursor-pointer ${selectedCategory === 'all' ? 'border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff]' : 'border-white/15 text-white/50 hover:text-white hover:border-white/30'}`}
              style={{ borderColor: selectedCategory === 'all' ? activeColor : undefined, color: selectedCategory === 'all' ? activeColor : undefined, backgroundColor: selectedCategory === 'all' ? `${activeColor}15` : undefined }}
            >
              🌌 ALL 100 MODULES
            </button>
            {Object.entries(FEATURE_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => { audioEngine.playClick(); setSelectedCategory(key as FeatureCategory) }}
                className={`px-3 py-1.5 rounded-full text-[7.5px] font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${selectedCategory === key ? 'border-white/60 bg-white/10 text-white' : 'border-white/15 text-white/50 hover:text-white hover:border-white/30'}`}
                style={{ borderColor: selectedCategory === key ? cat.color : undefined }}
              >
                <span>{cat.icon}</span>
                <span>{cat.name.toUpperCase()}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-[9px]">🔍</span>
            <input
              type="text"
              placeholder="SEARCH 100 FEATURES..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/40 border border-white/10 rounded px-2 pl-7 py-1.5 w-full sm:w-[220px] text-[8px] focus:outline-none focus:border-[#00e5ff]/40 text-white font-mono placeholder-white/20 tracking-wider"
            />
          </div>
        </div>

        {/* 100 Features Main Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 pt-2">
          {filtered.map((feature, idx) => {
            const isSelected = activeSubTool?.id === feature.id
            return (
              <motion.button
                key={feature.id}
                onClick={() => selectSubTool(feature)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`border rounded-lg p-3 text-left transition-all relative overflow-hidden backdrop-blur bg-white/5 hover:bg-white/10 cursor-pointer flex flex-col justify-between min-h-[95px] group ${isSelected ? activeBorder : 'border-white/5'}`}
                style={{
                  borderLeft: isSelected ? `3px solid ${activeColor}` : `3px solid ${feature.color}`
                }}
              >
                <div className="space-y-1.5 relative z-10">
                  <div className="flex justify-between items-start">
                    <span className="text-[14px]">{feature.icon}</span>
                    <span
                      className="text-[6.5px] px-1 py-0.5 rounded font-bold border"
                      style={{
                        borderColor: `${feature.color}30`,
                        color: feature.color,
                        backgroundColor: `${feature.color}08`
                      }}
                    >
                      {feature.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[8.5px] text-white tracking-wider truncate uppercase">{feature.name}</h4>
                    <p className="text-[7px] text-white/40 leading-relaxed mt-0.5 line-clamp-2">{feature.description}</p>
                  </div>
                </div>

                {/* Index Number */}
                <div className="absolute bottom-1 right-2 text-[14px] font-display font-extrabold text-white/[0.03] select-none group-hover:text-white/[0.08] transition-colors">
                  {String(idx + 1).padStart(3, '0')}
                </div>
              </motion.button>
            )
          })}
        </div>

      </div>

      {/* Interactive Sub-tool Telemetry Terminal Drawer */}
      <AnimatePresence>
        {activeSubTool && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 180, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t bg-[#00050d] relative z-20 flex shrink-0 transition-all duration-300"
            style={{ borderTopColor: `${activeColor}40` }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* Terminal output */}
            <div className="flex-1 p-3 flex flex-col min-w-0">
              <div className="flex justify-between items-center border-b border-white/10 pb-1.5 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px]">{activeSubTool.icon}</span>
                  <span className="font-bold tracking-widest text-[9.5px]" style={{ color: activeColor }}>TELEMETRY TERMINAL // {activeSubTool.name.toUpperCase()}</span>
                </div>
                <button
                  onClick={() => { audioEngine.playClick(); setActiveSubTool(null) }}
                  className="px-2 py-0.5 rounded border border-red-500/30 hover:border-red-500 bg-red-950/20 text-red-400 text-[8px] cursor-pointer"
                >
                  DISCONNECT
                </button>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-[7.5px] text-green-400 space-y-1 pr-2 no-scrollbar bg-black/40 p-2 rounded border border-white/5">
                {terminalLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-white/20 select-none">&gt;</span>
                    <span className="leading-normal tracking-wide whitespace-pre-wrap">{log}</span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>

            {/* Quick Actions Deck */}
            <div className="w-[180px] border-l border-white/10 p-3 bg-white/[0.02] flex flex-col justify-between shrink-0">
              <div>
                <span className="text-[7px] text-white/40 block tracking-wider uppercase mb-2">subsystem options</span>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white/5 p-1 px-2 rounded">
                    <span className="text-[7px] text-white/70">AUTO-RUN</span>
                    <input type="checkbox" defaultChecked className="accent-white scale-75 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-1 px-2 rounded">
                    <span className="text-[7px] text-white/70">VERBOSITY</span>
                    <span className="text-[7px] font-bold" style={{ color: activeColor }}>MAX</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  audioEngine.playAlert()
                  setTerminalLogs(prev => [...prev, `🔄 [FORCED MANUAL KICKSTART TRIGGERED AT ${new Date().toLocaleTimeString()}]`])
                }}
                className="w-full py-1.5 rounded border bg-transparent font-bold tracking-wider text-[8px] transition-all cursor-pointer"
                style={{ borderColor: activeColor, color: activeColor }}
              >
                EXECUTE CRON KICK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
