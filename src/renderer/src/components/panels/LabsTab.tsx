import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'

/* ═══════════════════ TYPES ═══════════════════ */

type LabTool = {
  id: string
  name: string
  icon: string
  color: string
  description: string
  category: 'coding' | 'analysis' | 'creative' | 'system' | 'fun'
}

const LAB_TOOLS: LabTool[] = [
  // ── Original Lab Tools ──
  { id: 'antigravity-ide', name: 'Antigravity IDE', icon: '🚀', color: '#00e5ff', description: 'Advanced AI Agentic IDE with terminal, file tree, diffs & swarm (Opens in IDE tab)', category: 'coding' },
  { id: 'compiler', name: 'Code Explainer', icon: '🧠', color: '#00e5ff', description: 'Generate & explain code line-by-line with AI', category: 'coding' },
  { id: 'radar', name: 'Radar Scanner', icon: '📡', color: '#22c55e', description: 'Real-time network & threat radar sweep', category: 'system' },
  { id: 'dreamscape', name: 'Dreamscape', icon: '🌌', color: '#c084fc', description: 'Neural dream network visualizer', category: 'creative' },
  { id: 'spectral', name: 'Spectral Audio', icon: '🎵', color: '#f97316', description: 'Audio waveform & spectrum analyzer', category: 'creative' },
  { id: 'genome', name: 'Genome Analyzer', icon: '🧬', color: '#10b981', description: 'DNA sequence & bio-lab analyzer', category: 'analysis' },
  { id: 'questlog', name: 'Quest Log', icon: '🎮', color: '#fbbf24', description: 'RPG-style quest journal & achievements', category: 'fun' },
  { id: 'starmap', name: 'Starmap Nav', icon: '⭐', color: '#3b82f6', description: 'Celestial star chart navigator', category: 'creative' },
  { id: 'pager', name: 'Pager Terminal', icon: '📟', color: '#22d3ee', description: 'Retro CRT cyberdeck terminal', category: 'system' },
  { id: 'moodmirror', name: 'Mood Mirror', icon: '🎭', color: '#ec4899', description: 'AR emotion & mood ring analyzer', category: 'analysis' },
  { id: 'timeline', name: 'Command Timeline', icon: '📜', color: '#a16207', description: 'Medieval scroll history viewer', category: 'fun' },
  { id: 'synthwave', name: 'Synthwave EQ', icon: '🎛️', color: '#d946ef', description: '80s neon equalizer deck', category: 'creative' },

  // ── Operations Tab Shortcuts ──
  { id: 'op-stealth', name: 'Stealth Solver', icon: '🤫', color: '#22c55e', description: 'Screen capture & test solving (Operations)', category: 'system' },
  { id: 'op-coding', name: 'Coding Sandbox', icon: '💻', color: '#00e5ff', description: 'Multi-language code executor (Operations)', category: 'coding' },
  { id: 'op-ppt', name: 'PPT Designer', icon: '📊', color: '#a855f7', description: 'AI presentation generator (Operations)', category: 'creative' },
  { id: 'op-iot', name: 'IoT Dashboard', icon: '🏠', color: '#f59e0b', description: 'Smart home control panel (Operations)', category: 'system' },
  { id: 'op-finance', name: 'Finance Tracker', icon: '🪙', color: '#10b981', description: 'Budget & crypto portfolio (Operations)', category: 'analysis' },
  { id: 'op-health', name: 'Health Tracker', icon: '🏥', color: '#ef4444', description: 'Water, medications & todos (Operations)', category: 'analysis' },
  { id: 'op-drone', name: 'Drone Simulator', icon: '🚁', color: '#f97316', description: 'Robotics & flight telemetry (Operations)', category: 'fun' },
  { id: 'op-devops', name: 'DevOps Console', icon: '📦', color: '#3b82f6', description: 'Git & Docker commands (Operations)', category: 'system' },

  // ── New Lab Tools ──
  { id: 'weather', name: 'Weather Station', icon: '🌤️', color: '#38bdf8', description: 'Live weather metrics with anemometer & gauges', category: 'system' },
  { id: 'stocks', name: 'Stock Ticker', icon: '📈', color: '#22c55e', description: 'LED ticker with candlestick price charts', category: 'analysis' },
  { id: 'particle', name: 'Particle Lab', icon: '🧪', color: '#f472b6', description: 'Physics sandbox with gravity & collisions', category: 'fun' },
  { id: 'minifier', name: 'Code Minifier', icon: '🗜️', color: '#f97316', description: 'Crunch & compress code with size gauges', category: 'coding' },
  { id: 'translator', name: 'Translator', icon: '🌐', color: '#818cf8', description: 'Multi-language translation with passport stamps', category: 'creative' },

  // ── Mission Control & Agent Forge ──
  { id: 'missioncontrol', name: 'Mission Control', icon: '🚀', color: '#00e5ff', description: 'Roadmap dashboard tracking all feature progress', category: 'system' },
  { id: 'agentforge', name: 'Agent Forge', icon: '🤖', color: '#a78bfa', description: 'Autonomous agent launchpad & multi-agent orchestration', category: 'coding' },
  { id: 'wall-mapper', name: 'Spatial Wall Mapper', icon: '📐', color: '#00ffff', description: 'AR room mapping and wall detection using live camera projection grids', category: 'analysis' },
  { id: 'intelligence-matrix', name: 'Intelligence Matrix', icon: '💠', color: '#a855f7', description: 'Directory of 50 autonomous high intelligence features, active sub-agents, and heuristic processes', category: 'system' },
  { id: 'live-notes', name: 'Live Note Tracker', icon: '📝', color: '#10b981', description: 'Live audio transcription and auto-summarized smart notes from system or microphone', category: 'analysis' },
]

/* ═══════════════════ CATEGORY DEFINITIONS ═══════════════════ */

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  all: { label: 'All Tools', icon: '🔧' },
  coding: { label: 'Coding', icon: '💻' },
  analysis: { label: 'Analysis', icon: '📊' },
  creative: { label: 'Creative', icon: '🎨' },
  system: { label: 'System', icon: '⚙️' },
  fun: { label: 'Fun', icon: '🎮' },
}

/* ═══════════════════ LABS TAB — MAIN LAUNCHER ═══════════════════ */

export function LabsTab(): React.JSX.Element {
  const activeLab = useJarvisStore((s) => s.activeLab)
  const setActiveLab = useJarvisStore((s) => s.setActiveLab)
  const setActiveTab = useJarvisStore((s) => s.setActiveTab)
  const [category, setCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: Ctrl+F / Cmd+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && searchRef.current) {
        e.preventDefault()
        searchRef.current.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Handle redirect to Operations tab
  const handleToolClick = (tool: LabTool) => {
    audioEngine.playElevate()
    if (tool.id.startsWith('op-')) {
      // Redirect to Operations tab
      setActiveLab(null)
      setActiveTab('trackers')
    } else if (tool.id === 'antigravity-ide') {
      setActiveLab(null)
      setActiveTab('ide')
    } else {
      setActiveLab(tool.id)
    }
  }

  if (activeLab) {
    const tool = LAB_TOOLS.find(t => t.id === activeLab)
    if (!tool) {
      setActiveLab(null)
      return <div />
    }
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 shrink-0">
          <button
            onClick={() => {
              audioEngine.playClick()
              setActiveLab(null)
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 hover:border-white/30 text-white/60 hover:text-white text-[9px] font-mono tracking-wider transition-all cursor-pointer"
          >
            ← BACK TO LABS
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[11px]">{tool.icon}</span>
          <span className="font-mono text-[10px] tracking-wider text-white/80 font-semibold">{tool.name}</span>
          {tool.id.startsWith('op-') && (
            <span className="ml-auto text-[7px] text-[#fbbf24]/60 font-mono italic tracking-wider">→ Opens in Operations tab</span>
          )}
          {tool.id === 'antigravity-ide' && (
            <span className="ml-auto text-[7px] text-[#00e5ff]/80 font-mono italic tracking-wider">→ Opens in ANTIGRAVITY IDE tab</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {activeLab === 'compiler' && <CodeExplainerView />}
          {activeLab === 'radar' && <RadarScannerView />}
          {activeLab === 'dreamscape' && <DreamscapeView />}
          {activeLab === 'spectral' && <SpectralAudioLabView />}
          {activeLab === 'genome' && <GenomeAnalyzerView />}
          {activeLab === 'questlog' && <QuestLogView />}
          {activeLab === 'starmap' && <StarmapNavigatorView />}
          {activeLab === 'pager' && <PagerTerminalView />}
          {activeLab === 'moodmirror' && <MoodMirrorView />}
          {activeLab === 'timeline' && <CommandTimelineView />}
          {activeLab === 'synthwave' && <SynthwaveEqualizerView />}
          {activeLab === 'weather' && <WeatherStationView />}
          {activeLab === 'stocks' && <StockTickerView />}
          {activeLab === 'particle' && <ParticleLabView />}
          {activeLab === 'minifier' && <CodeMinifierView />}
          {activeLab === 'translator' && <TranslatorView />}
          {activeLab === 'missioncontrol' && <MissionControlView />}
          {activeLab === 'agentforge' && <AgentForgeView />}
          {activeLab === 'wall-mapper' && <WallMapperView />}
          {activeLab === 'intelligence-matrix' && <IntelligenceMatrixView />}
          {activeLab === 'live-notes' && <LiveNotesView />}
        </div>
      </div>
    )
  }

  const filteredTools = LAB_TOOLS
    .filter(t => category === 'all' || t.category === category)
    .filter(t =>
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )

  return (
    <div className="h-full flex flex-col min-h-0 select-none">
      {/* Category filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto no-scrollbar shrink-0 border-b border-white/5">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => {
              audioEngine.playClick()
              setCategory(key)
            }}
            className={`px-3 py-1.5 rounded-full font-mono text-[8px] tracking-wider border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              category === key
                ? 'border-[#00e5ff]/40 bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.15)] font-semibold'
                : 'border-white/5 hover:border-white/20 text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      {!activeLab && (
        <div className="px-4 pt-3 pb-1 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 pointer-events-none">🔍</span>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                audioEngine.playKeyboardTyping()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('')
                  searchRef.current?.blur()
                }
              }}
              placeholder="Search tools by name or description... (Ctrl+F)"
              className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-[10px] text-white/80 font-mono focus:outline-none focus:border-[#00e5ff]/40 transition-all placeholder-white/20 tracking-wider"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  searchRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white/30 hover:text-white/60 transition-colors cursor-pointer px-1"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery && filteredTools.length === 0 && (
            <div className="mt-2 text-[8px] text-white/30 font-mono tracking-wider text-center py-1">
              No tools found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Tool Grid */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTools.map((tool, i) => (
            <motion.button
              key={tool.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleToolClick(tool)}
              className="group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{
                borderColor: `${tool.color}25`,
                backgroundColor: `${tool.color}08`,
              }}
              onMouseEnter={() => audioEngine.playHover()}
            >
              {/* Background glow */}
              <div
                className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-2xl pointer-events-none"
                style={{ backgroundColor: tool.color }}
              />
              <div className="relative z-10 space-y-2">
                <span className="text-2xl block">{tool.icon}</span>
                <div>
                  <h3 className="font-mono text-[10px] font-bold tracking-wider text-white/90">
                    {tool.name}
                  </h3>
                  <p className="font-mono text-[7.5px] text-white/40 leading-relaxed mt-1 line-clamp-2">
                    {tool.description}
                  </p>
                </div>
                <div
                  className="inline-block px-2 py-0.5 rounded-full text-[7px] font-mono tracking-wider uppercase"
                  style={{
                    backgroundColor: `${tool.color}15`,
                    color: tool.color,
                    borderColor: `${tool.color}30`,
                    borderWidth: 1,
                  }}
                >
                  {tool.category}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   1. CODE EXPLAINER — DOC BROWSER AESTHETIC
   ═══════════════════════════════════════════════════ */

function CodeExplainerView(): React.JSX.Element {
  const compilerResult = useJarvisStore((s) => s.compilerResult)
  const setCompilerResult = useJarvisStore((s) => s.setCompilerResult)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('python')
  const [mode, setMode] = useState<'generate' | 'explain'>('generate')
  const [question, setQuestion] = useState('')
  const [processing, setProcessing] = useState(false)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)

  const handleRun = () => {
    if (mode === 'generate' && !question.trim()) return
    if (mode === 'explain' && !code.trim()) return
    audioEngine.playClick()
    setProcessing(true)

    const payload = mode === 'generate'
      ? `${question}|${language}`
      : `explain|${code}|${language}`

    sendWsMessage('run_tool', { tag: 'COMPILER', content: payload })
  }

  useEffect(() => {
    if (!processing || !lastToolResult) return
    if (lastToolResult.tag !== 'COMPILER') return
    setProcessing(false)
    setCompilerResult(lastToolResult.result || 'No explanation generated.')
  }, [lastToolResult, processing, setCompilerResult])

  // Dynamic doc-browser font
  useEffect(() => {
    if (!document.getElementById('labs-fonts')) {
      const link = document.createElement('link')
      link.id = 'labs-fonts'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;600;700&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  const languages = [
    'python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp',
    'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'bash'
  ]

  return (
    <div
      className="h-full flex flex-col min-h-0 font-mono"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4 shrink-0">
        <button
          onClick={() => { setMode('generate'); audioEngine.playClick() }}
          className={`px-4 py-2 rounded-lg text-[10px] font-semibold tracking-wider border transition-all cursor-pointer ${
            mode === 'generate'
              ? 'border-[#00e5ff]/50 bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.1)]'
              : 'border-white/10 text-white/50 hover:text-white hover:border-white/30'
          }`}
        >
          📝 Generate & Explain
        </button>
        <button
          onClick={() => { setMode('explain'); audioEngine.playClick() }}
          className={`px-4 py-2 rounded-lg text-[10px] font-semibold tracking-wider border transition-all cursor-pointer ${
            mode === 'explain'
              ? 'border-[#00e5ff]/50 bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.1)]'
              : 'border-white/10 text-white/50 hover:text-white hover:border-white/30'
          }`}
        >
          🔍 Explain Code
        </button>
      </div>

      {/* Input area */}
      <div className="shrink-0 space-y-3 mb-4 bg-[#0a0e17] border border-white/5 rounded-xl p-4">
        {/* Language & Controls */}
        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-black/50 border border-white/10 rounded px-3 py-1.5 text-[10px] text-[#00e5ff] font-mono focus:outline-none focus:border-[#00e5ff]/40 cursor-pointer"
          >
            {languages.map(l => (
              <option key={l} value={l} className="bg-[#0a0e17]">{l}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            onClick={handleRun}
            disabled={processing || (mode === 'generate' && !question.trim()) || (mode === 'explain' && !code.trim())}
            className="px-5 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderColor: '#00e5ff40',
              backgroundColor: '#00e5ff12',
              color: '#00e5ff',
            }}
          >
            {processing ? '⟳ PROCESSING...' : '⚡ COMPILE'}
          </button>
        </div>

        {/* Question input (generate mode) */}
        {mode === 'generate' && (
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a programming question... e.g. 'Write a Python function to sort a list using merge sort'"
            rows={3}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/90 font-light focus:outline-none focus:border-[#00e5ff]/35 resize-none placeholder-white/20 leading-relaxed"
          />
        )}

        {/* Code input (explain mode) */}
        {mode === 'explain' && (
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste code you'd like explained line-by-line..."
            rows={6}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-[#a8e6cf] font-mono focus:outline-none focus:border-[#00e5ff]/35 resize-none placeholder-white/20 leading-relaxed"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        )}
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#0a0e17] border border-white/5 rounded-xl p-4">
        <div className="text-[8px] text-white/30 tracking-widest uppercase mb-3 font-mono shrink-0 border-b border-white/5 pb-2">
          {processing ? '⟳ GENERATING EXPLANATION...' : 'COMPILER OUTPUT'}
        </div>

        {processing ? (
          <div className="flex items-center justify-center py-12">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 border-t-2 border-[#00e5ff] rounded-full animate-spin" />
              <div className="absolute inset-2 border-b-2 border-[#00e5ff]/50 rounded-full animate-spin [animation-direction:reverse]" />
            </div>
          </div>
        ) : compilerResult ? (
          <div className="prose prose-invert max-w-none text-[11px] leading-relaxed font-light select-text">
            <pre className="whitespace-pre-wrap text-[11px] text-[#a8e6cf] leading-relaxed font-mono">{compilerResult}</pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-white/30">
            <span className="text-3xl mb-3">📄</span>
            <p className="font-mono text-[9px] tracking-wider">
              {mode === 'generate'
                ? 'Ask a question to generate and explain code'
                : 'Paste code to get a line-by-line explanation'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   2. RADAR SCANNER — MILITARY RADAR/PULSE UI
   ═══════════════════════════════════════════════════ */

function RadarScannerView(): React.JSX.Element {
  const [angle, setAngle] = useState(0)
  const [blips] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      distance: 20 + Math.random() * 60,
      angle: Math.random() * 360,
      label: ['NODE-0', 'AP-2', 'HOST-5', 'GW-1', 'SERV-3', 'CLIENT-7', 'DNS-4', 'DHCP-6'][i] || `BLIP-${i}`,
      status: Math.random() > 0.3 ? 'online' as const : 'unknown' as const,
    }))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setAngle(prev => (prev + 2) % 360)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  // Inject radar font
  useEffect(() => {
    if (!document.getElementById('radar-font')) {
      const link = document.createElement('link')
      link.id = 'radar-font'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 font-mono">
      <style>{`.radar-text { font-family: 'Share Tech Mono', monospace; }`}</style>

      <div className="flex-1 flex items-center justify-center relative min-h-0">
        {/* Radar Display */}
        <div className="relative w-60 h-60">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border border-[#22c55e]/40" />
          {/* Inner rings */}
          <div className="absolute inset-[25%] rounded-full border border-[#22c55e]/15" />
          <div className="absolute inset-[50%] rounded-full border border-[#22c55e]/10" />
          <div className="absolute inset-[75%] rounded-full border border-[#22c55e]/5" />
          {/* Crosshairs */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-[#22c55e]/10" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#22c55e]/10" />

          {/* Sweep line */}
          <div
            className="absolute top-1/2 left-1/2 w-[45%] h-px origin-left transition-none"
            style={{
              transform: `rotate(${angle}deg)`,
              background: 'linear-gradient(90deg, #22c55e 0%, transparent 100%)',
              boxShadow: '0 0 8px #22c55e80',
            }}
          />
          {/* Sweep cone */}
          <div
            className="absolute top-0 left-0 w-full h-full rounded-full opacity-10"
            style={{
              background: `conic-gradient(from ${angle - 30}deg, #22c55e 0deg, #22c55e 60deg, transparent 60deg, transparent 360deg)`,
            }}
          />

          {/* Blips */}
          {blips.map((blip) => {
            const rad = (blip.angle * Math.PI) / 180
            const radius = (blip.distance / 100) * 45
            const x = 50 + radius * Math.cos(rad)
            const y = 50 + radius * Math.sin(rad)
            const isSwept = Math.abs(blip.angle - angle) < 60 || Math.abs(blip.angle - angle + 360) < 60
            return (
              <div
                key={blip.id}
                className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  opacity: isSwept ? 1 : 0.3,
                }}
              >
                <div
                  className={`w-full h-full rounded-full ${blip.status === 'online' ? 'animate-ping' : ''}`}
                  style={{
                    backgroundColor: blip.status === 'online' ? '#22c55e' : '#facc15',
                    boxShadow: `0 0 8px ${blip.status === 'online' ? '#22c55e' : '#facc15'}`,
                  }}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[7px] text-[#22c55e]/70 whitespace-nowrap radar-text">
                  {blip.label}
                </span>
              </div>
            )
          })}

          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22c55e] shadow-[0_0_12px_#22c55e]" />
        </div>
      </div>

      {/* Threats list */}
      <div className="shrink-0 border-t border-[#22c55e]/15 p-3 space-y-1.5">
        <div className="text-[8px] text-[#22c55e]/70 tracking-[0.25em] uppercase radar-text mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          DETECTED SIGNATURES ({blips.filter(b => b.status === 'online').length})
        </div>
        {blips.filter(b => b.status === 'online').slice(0, 4).map(b => (
          <div key={b.id} className="flex items-center gap-2 text-[8px] radar-text">
            <span className="w-1 h-1 rounded-full bg-[#22c55e]" />
            <span className="text-[#22c55e]/80">{b.label}</span>
            <span className="text-white/30">|</span>
            <span className="text-white/40">{b.distance.toFixed(0)}m</span>
            <span className="text-white/30">|</span>
            <span className="text-emerald-400">{b.angle.toFixed(0)}°</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   3. DREAMSCAPE — SURREAL NEURAL NODES UI
   ═══════════════════════════════════════════════════ */

function DreamscapeView(): React.JSX.Element {
  const [nodes] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 12,
      color: ['#c084fc', '#e879f9', '#f0abfc', '#818cf8', '#a78bfa'][Math.floor(Math.random() * 5)],
      pulse: Math.random() * 3,
    }))
  )

  const [connections] = useState(() => {
    const conns: { from: number; to: number }[] = []
    for (let i = 0; i < 16; i++) {
      conns.push({ from: Math.floor(Math.random() * 20), to: Math.floor(Math.random() * 20) })
    }
    return conns
  })

  const [thoughts] = useState([
    'Processing memory vectors...',
    'Synaptic patterns detected',
    'Dream state: lucid',
    'Neural resonance at 7.83Hz',
    'Subconscious data mining...',
  ])

  return (
    <div className="h-full flex flex-col min-h-0 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0524 0%, #1a0533 50%, #0f0524 100%)' }}>
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {nodes.map(node => (
          <motion.div
            key={node.id}
            className="absolute rounded-full"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: node.size,
              height: node.size,
              backgroundColor: node.color,
              boxShadow: `0 0 ${node.size * 2}px ${node.color}60`,
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: 3 + node.pulse,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full">
          {connections.map((conn, i) => {
            const from = nodes[conn.from]
            const to = nodes[conn.to]
            if (!from || !to) return null
            return (
              <line
                key={i}
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke="#c084fc"
                strokeWidth="0.3"
                strokeOpacity="0.2"
              />
            )
          })}
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 select-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="w-32 h-32 rounded-full border border-[#c084fc]/20 mb-6 flex items-center justify-center relative"
        >
          <div className="absolute inset-2 rounded-full border border-[#e879f9]/15" />
          <div className="absolute inset-5 rounded-full border border-[#f0abfc]/10" />
          <span className="text-3xl">🌌</span>
        </motion.div>

        <h2 className="font-mono text-[11px] text-[#c084fc] tracking-[0.25em] uppercase font-semibold">
          Dreamscape Active
        </h2>
        <p className="font-mono text-[8px] text-white/40 mt-2 tracking-wider">
          Neural Oscillation: α (8-12 Hz)
        </p>
      </div>

      {/* Thought stream */}
      <div className="shrink-0 border-t border-[#c084fc]/15 p-4">
        <div className="space-y-2">
          {thoughts.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.2 }}
              className="flex items-center gap-2 text-[8px] font-mono text-[#c084fc]/60"
            >
              <span className="w-1 h-1 rounded-full bg-[#c084fc]/40" />
              <span className="italic">{t}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   4. SPECTRAL AUDIO LAB — OSCILLOSCOPE UI
   ═══════════════════════════════════════════════════ */

function SpectralAudioLabView(): React.JSX.Element {
  const [bars, setBars] = useState(() =>
    Array.from({ length: 32 }, () => Math.random() * 80 + 10)
  )
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 80 + 10))
    }, 150)
    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#0a0808' }}>
      {/* Vintage equalizer header */}
      <div className="border-b border-[#f97316]/20 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#f97316] text-lg">🎵</span>
          <div>
            <h3 className="text-[10px] text-[#f97316] tracking-[0.2em] uppercase font-bold">Spectral Analyzer</h3>
            <p className="text-[7px] text-[#f97316]/50 tracking-wider">REALTIME FFT • 32-BAND</p>
          </div>
        </div>
        <button
          onClick={() => {
            audioEngine.playClick()
            setIsPlaying(!isPlaying)
          }}
          className={`px-4 py-1.5 rounded border text-[9px] font-bold tracking-wider uppercase cursor-pointer transition-all ${
            isPlaying
              ? 'border-[#f97316] bg-[#f97316]/15 text-[#f97316] animate-pulse'
              : 'border-[#f97316]/30 text-[#f97316]/60 hover:text-[#f97316] hover:border-[#f97316]/60'
          }`}
        >
          {isPlaying ? '■ STOP' : '▶ PLAY'}
        </button>
      </div>

      {/* Oscilloscope waveform */}
      <div className="flex-1 flex flex-col justify-center px-4 py-6 min-h-0">
        {/* Waveform SVG */}
        <div className="h-24 mb-6 border border-[#f97316]/10 rounded bg-black/60 p-2 relative overflow-hidden">
          <div className="absolute top-1 left-2 text-[6px] text-[#f97316]/30 tracking-wider">CH₁</div>
          <div className="absolute bottom-1 right-2 text-[6px] text-[#f97316]/30">500mV/div</div>
          <svg viewBox="0 0 400 80" className="w-full h-full">
            <path
              d={Array.from({ length: 80 }, (_, i) => {
                const x = (i / 80) * 400
                const y = 40 + Math.sin(i * 0.5 + Date.now() * 0.005) * 30 + Math.sin(i * 0.2) * 10
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
              }).join(' ')}
              fill="none"
              stroke="#f97316"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          </svg>
        </div>

        {/* Frequency bars */}
        <div className="space-y-2">
          <div className="text-[7px] text-[#f97316]/50 tracking-widest uppercase">Frequency Spectrum</div>
          <div className="flex items-end gap-[3px] h-20">
            {bars.map((bar, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t-sm origin-bottom"
                style={{
                  backgroundColor: i > 22 ? '#ef4444' : i > 14 ? '#f97316' : i > 6 ? '#eab308' : '#22c55e',
                  opacity: 0.8,
                }}
                animate={{ height: `${bar}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* VU Meter */}
      <div className="shrink-0 border-t border-[#f97316]/15 p-3 space-y-2">
        <div className="flex gap-3 items-center">
          <div className="text-[7px] text-[#f97316]/60 tracking-widest uppercase">VU</div>
          <div className="flex-1 h-2 bg-black/60 rounded-full border border-[#f97316]/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #22c55e, #eab308, #ef4444)',
              }}
              animate={{ width: `${20 + Math.random() * 60}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <div className="flex justify-between text-[6px] text-[#f97316]/40 tracking-wider">
          <span>20Hz</span>
          <span>200Hz</span>
          <span>2kHz</span>
          <span>20kHz</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   5. GENOME ANALYZER — BIO LAB UI
   ═══════════════════════════════════════════════════ */

function GenomeAnalyzerView(): React.JSX.Element {
  const [sequence] = useState(() => {
    const bases = ['A', 'T', 'G', 'C']
    return Array.from({ length: 60 }, () => bases[Math.floor(Math.random() * 4)])
  })

  const baseColors: Record<string, string> = {
    A: '#22c55e',
    T: '#ef4444',
    G: '#f97316',
    C: '#3b82f6',
  }

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#06110e' }}>
      {/* Header */}
      <div className="border-b border-[#10b981]/20 px-4 py-3 shrink-0 flex items-center gap-3">
        <span className="text-lg">🧬</span>
        <div>
          <h3 className="text-[10px] text-[#10b981] tracking-[0.2em] uppercase font-bold">Genome Sequencer</h3>
          <p className="text-[7px] text-[#10b981]/50">HOMO SAPIENS • CHR 22</p>
        </div>
      </div>

      {/* DNA Helix visualization */}
      <div className="flex-1 p-4 space-y-4 min-h-0 overflow-y-auto">
        {/* DNA strand */}
        <div className="border border-[#10b981]/15 rounded-xl p-4 bg-black/30">
          <div className="text-[7px] text-[#10b981]/60 tracking-widest uppercase mb-3">DNA Double Helix • 5' → 3'</div>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 8 }, (_, row) => {
              const leftBase = sequence[row * 2] || 'A'
              const rightBase = sequence[row * 2 + 1] || 'T'
              const pair = `${leftBase}-${rightBase}`
              const isMatch = (leftBase === 'A' && rightBase === 'T') || (leftBase === 'T' && rightBase === 'A') ||
                             (leftBase === 'G' && rightBase === 'C') || (leftBase === 'C' && rightBase === 'G')
              return (
                <div key={row} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: `${baseColors[leftBase]}30`, color: baseColors[leftBase], border: `1px solid ${baseColors[leftBase]}50` }}
                  >
                    {leftBase}
                  </div>
                  <div className={`flex-1 h-px ${isMatch ? 'bg-[#10b981]/30' : 'bg-red-500/30'}`} />
                  <div className="flex items-center gap-1 text-[7px] text-white/30">{pair}</div>
                  <div className={`flex-1 h-px ${isMatch ? 'bg-[#10b981]/30' : 'bg-red-500/30'}`} />
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: `${baseColors[rightBase]}30`, color: baseColors[rightBase], border: `1px solid ${baseColors[rightBase]}50` }}
                  >
                    {rightBase}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sequence Readout */}
        <div className="border border-[#10b981]/15 rounded-xl p-4 bg-black/30">
          <div className="text-[7px] text-[#10b981]/60 tracking-widest uppercase mb-2">Nucleotide Sequence</div>
          <div className="flex flex-wrap gap-1">
            {sequence.map((base, i) => (
              <span
                key={i}
                className="w-4 h-4 flex items-center justify-center text-[7px] font-bold rounded"
                style={{ backgroundColor: `${baseColors[base]}20`, color: baseColors[base] }}
              >
                {base}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'GC Content', value: `${((sequence.filter(b => b === 'G' || b === 'C').length / sequence.length) * 100).toFixed(0)}%` },
            { label: 'Length', value: `${sequence.length} bp` },
            { label: 'Mutations', value: '0 detected' },
          ].map((stat) => (
            <div key={stat.label} className="border border-[#10b981]/10 rounded-lg p-2.5 bg-black/20 text-center">
              <div className="text-[10px] text-[#10b981] font-bold">{stat.value}</div>
              <div className="text-[6px] text-[#10b981]/50 tracking-wider mt-1 uppercase">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   6. QUEST LOG — RETRO RPG UI
   ═══════════════════════════════════════════════════ */

function QuestLogView(): React.JSX.Element {
  const [xp, setXp] = useState(1250)
  const [level, setLevel] = useState(5)
  const [quests, setQuests] = useState([
    { id: 'q1', name: 'Connect to Backend', exp: 150, done: true },
    { id: 'q2', name: 'Run First AI Query', exp: 300, done: true },
    { id: 'q3', name: 'Explore All Labs', exp: 200, done: false },
    { id: 'q4', name: 'Master the Code Explainer', exp: 500, done: false },
    { id: 'q5', name: 'Achieve Orb Mastery', exp: 1000, done: false },
  ])

  const xpNeeded = level * 500
  const xpProgress = (xp / xpNeeded) * 100

  const handleComplete = (id: string, exp: number) => {
    audioEngine.playSuccess()
    setXp(prev => prev + exp)
    setLevel(prev => Math.floor((xp + exp) / 500) + 1)
    setQuests(prev => prev.map(q => q.id === id ? { ...q, done: true } : q))
  }

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#1a0f0a' }}>
      {/* Pixel font */}
      {(() => { if (!document.getElementById('quest-font')) { const l = document.createElement('link'); l.id = 'quest-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'; document.head.appendChild(l); } return null })()}
      <style>{`.pixel-text { font-family: 'Press Start 2P', monospace; letter-spacing: 0; }`}</style>

      {/* HUD Header */}
      <div className="border-b-2 border-[#fbbf24]/30 px-4 py-3 shrink-0" style={{ borderStyle: 'dashed' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-lg">🎮</span>
          <h3 className="text-[9px] text-[#fbbf24] tracking-wide font-bold pixel-text" style={{ fontSize: '7px' }}>QUEST LOG</h3>
        </div>
        <div className="flex items-center gap-4 text-[8px]">
          <div className="flex items-center gap-1.5 pixel-text" style={{ fontSize: '6px' }}>
            <span className="text-[#fbbf24]">LV.{level}</span>
            <span className="text-white/40">|</span>
            <span className="text-[#fbbf24]/80">XP {xp}/{xpNeeded}</span>
          </div>
          <div className="flex-1 h-2 bg-black/60 border border-[#fbbf24]/30 rounded overflow-hidden">
            <motion.div
              className="h-full rounded"
              style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}
              animate={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {quests.map((quest, i) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`border-2 p-3 rounded transition-all ${quest.done ? 'border-[#fbbf24]/10 opacity-60' : 'border-[#fbbf24]/30 hover:border-[#fbbf24]/60'}`}
            style={{ borderStyle: 'dashed', background: quest.done ? '#fbbf2408' : '#fbbf2404' }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center mt-0.5 ${quest.done ? 'border-[#fbbf24] bg-[#fbbf24]' : 'border-white/30'}`}>
                {quest.done && <span className="text-[8px] text-black font-bold">✓</span>}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] font-bold pixel-text tracking-wide ${quest.done ? 'text-white/50 line-through' : 'text-[#fbbf24]'}`} style={{ fontSize: '7px' }}>
                    {quest.name}
                  </span>
                  <span className="text-[7px] text-[#fbbf24]/60 pixel-text" style={{ fontSize: '5px' }}>+{quest.exp}XP</span>
                </div>
                {!quest.done && (
                  <button
                    onClick={() => handleComplete(quest.id, quest.exp)}
                    className="mt-2 px-3 py-1 text-[7px] pixel-text border border-[#fbbf24]/40 text-[#fbbf24] rounded hover:bg-[#fbbf24]/10 transition-all cursor-pointer"
                    style={{ fontSize: '6px' }}
                  >
                    COMPLETE QUEST
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   7. STARMAP NAVIGATOR — CELESTIAL UI
   ═══════════════════════════════════════════════════ */

function StarmapNavigatorView(): React.JSX.Element {
  const [stars] = useState(() =>
    Array.from({ length: 80 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.7,
      twinkle: Math.random() * 3,
    }))
  )

  const [constellations] = useState(() => {
    const groups: { name: string; stars: number[] }[] = []
    for (let g = 0; g < 3; g++) {
      const starIndices = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, () => Math.floor(Math.random() * 80))
      groups.push({
        name: ['LYRA', 'CYGNUS', 'ORION', 'CASSIOPEIA', 'URSA'][g] || `CONST-${g}`,
        stars: starIndices,
      })
    }
    return groups
  })

  return (
    <div className="h-full flex flex-col min-h-0 relative overflow-hidden select-none" style={{ background: '#020a1a' }}>
      {/* Star field */}
      <div className="absolute inset-0 overflow-hidden">
        {stars.map((star, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size + 0.5,
              height: star.size + 0.5,
              backgroundColor: '#fff',
              boxShadow: `0 0 ${star.size * 2}px rgba(255,255,255,${star.opacity * 0.5})`,
            }}
            animate={{ opacity: [star.opacity * 0.5, star.opacity, star.opacity * 0.5] }}
            transition={{ duration: 1.5 + star.twinkle, repeat: Infinity }}
          />
        ))}
        {/* Constellation lines */}
        <svg className="absolute inset-0 w-full h-full">
          {constellations.map((constel) =>
            constel.stars.slice(0, -1).map((idx, j) => {
              const s1 = stars[idx]
              const s2 = stars[constel.stars[j + 1]]
              if (!s1 || !s2) return null
              return (
                <line
                  key={`${constel.name}-${j}`}
                  x1={`${s1.x}%`}
                  y1={`${s1.y}%`}
                  x2={`${s2.x}%`}
                  y2={`${s2.y}%`}
                  stroke="#3b82f6"
                  strokeWidth="0.3"
                  strokeOpacity="0.15"
                />
              )
            })
          )}
        </svg>
        {/* Constellation labels */}
        {constellations.map((constel) => {
          const avgX = constel.stars.reduce((sum, idx) => sum + (stars[idx]?.x || 0), 0) / constel.stars.length
          const avgY = constel.stars.reduce((sum, idx) => sum + (stars[idx]?.y || 0), 0) / constel.stars.length
          return (
            <div
              key={constel.name}
              className="absolute font-mono text-[6px] text-[#3b82f6]/40 tracking-[0.3em] uppercase"
              style={{ left: `${avgX}%`, top: `${avgY - 4}%`, transform: 'translateX(-50%)' }}
            >
              {constel.name}
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="w-28 h-28 rounded-full border border-[#3b82f6]/20 flex items-center justify-center"
          >
            <div className="text-2xl">⭐</div>
          </motion.div>
          {/* Reticle */}
          <div className="absolute -top-2 -left-2 w-2 h-2 border-t border-l border-[#3b82f6]/60" />
          <div className="absolute -top-2 -right-2 w-2 h-2 border-t border-r border-[#3b82f6]/60" />
          <div className="absolute -bottom-2 -left-2 w-2 h-2 border-b border-l border-[#3b82f6]/60" />
          <div className="absolute -bottom-2 -right-2 w-2 h-2 border-b border-r border-[#3b82f6]/60" />
        </div>
        <h3 className="font-mono text-[10px] text-[#3b82f6] tracking-[0.3em] uppercase mt-4 font-bold">Starmap Active</h3>
        <p className="font-mono text-[7px] text-white/30 mt-1">RA 12h 34m • DEC +45° 67'</p>
      </div>

      {/* Legend */}
      <div className="relative z-10 shrink-0 border-t border-[#3b82f6]/15 p-3">
        <div className="flex gap-4 text-[7px] font-mono text-white/40 tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
            <span>{stars.length} Celestial Bodies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-[1px] bg-[#3b82f6]/40" />
            <span>{constellations.length} Constellations</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   8. PAGER TERMINAL — CYBERDECK CRT UI
   ═══════════════════════════════════════════════════ */

function PagerTerminalView(): React.JSX.Element {
  const [lines, setLines] = useState([
    { text: 'ASTRYX PAGER v2.4.1 BOOT', ts: Date.now() - 5000 },
    { text: 'CRYPTO INIT: RSA-4096', ts: Date.now() - 4000 },
    { text: 'SYS.RELAY ESTABLISHED', ts: Date.now() - 3000 },
    { text: 'AWAITING INPUT...', ts: Date.now() - 2000 },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    if (!input.trim()) return
    audioEngine.playKeyboardTyping()
    setLines(prev => [
      ...prev,
      { text: `> ${input.toUpperCase()}`, ts: Date.now() },
      { text: `[ACK] ${input.length} BYTES TRANSMITTED`, ts: Date.now() + 100 },
    ])
    setInput('')
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#0a0a00' }}>
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(34, 211, 238, 0.15) 1px, rgba(34, 211, 238, 0.15) 2px)',
          backgroundSize: '100% 2px',
        }}
      />

      {/* CRT Header */}
      <div className="border-b border-[#22d3ee]/30 px-4 py-2 shrink-0 flex items-center gap-2 select-none">
        <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse shadow-[0_0_6px_#22d3ee]" />
        <span className="text-[9px] text-[#22d3ee] tracking-[0.3em] uppercase font-bold" style={{ textShadow: '0 0 8px #22d3ee80' }}>PAGER TERMINAL</span>
        <span className="flex-1" />
        <span className="text-[7px] text-[#22d3ee]/40 tracking-wider">4800 BAUD</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0"
        style={{ filter: 'contrast(1.05) brightness(1.1)' }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-[9px] leading-relaxed tracking-wide"
            style={{
              color: '#22d3ee',
              textShadow: '0 0 4px #22d3ee40',
              fontFamily: "'Courier New', monospace",
            }}
          >
            <span className="text-[#22d3ee]/40">[{new Date(line.ts).toLocaleTimeString()}]</span>{' '}
            {line.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#22d3ee]/20 p-3 flex gap-2">
        <span className="text-[#22d3ee] text-[10px] self-center animate-pulse" style={{ textShadow: '0 0 6px #22d3ee' }}>❯</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="TYPE MESSAGE..."
          className="flex-1 bg-transparent border-none outline-none text-[9px] tracking-wider text-[#22d3ee] placeholder-[#22d3ee]/20 uppercase"
          style={{ fontFamily: "'Courier New', monospace", textShadow: '0 0 4px #22d3ee40' }}
        />
        <button
          onClick={handleSend}
          className="px-3 py-1 text-[8px] tracking-widest border border-[#22d3ee]/30 text-[#22d3ee] hover:bg-[#22d3ee]/10 uppercase cursor-pointer transition-all"
        >
          SEND
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   9. MOOD MIRROR — AR GLASSMORPHISM UI
   ═══════════════════════════════════════════════════ */

function MoodMirrorView(): React.JSX.Element {
  const [emotions] = useState([
    { label: 'Joy', value: 65, color: '#fbbf24' },
    { label: 'Focus', value: 82, color: '#3b82f6' },
    { label: 'Calm', value: 45, color: '#22c55e' },
    { label: 'Energy', value: 70, color: '#f97316' },
    { label: 'Stress', value: 30, color: '#ef4444' },
  ])

  const [moodRing, setMoodRing] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setMoodRing(prev => (prev + 1) % 360)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 relative overflow-hidden select-none" style={{ background: 'linear-gradient(135deg, #1a0a1e 0%, #2d1b3d 50%, #1a0a1e 100%)' }}>
      {/* Glass reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {/* Face Wireframe */}
        <div className="relative w-32 h-32 mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Head outline */}
            <ellipse cx="50" cy="48" rx="30" ry="35" fill="none" stroke="#ec4899" strokeWidth="0.8" strokeOpacity="0.3" />
            {/* Eyes */}
            <circle cx="38" cy="42" r="4" fill="none" stroke="#ec4899" strokeWidth="0.6" strokeOpacity="0.4" />
            <circle cx="62" cy="42" r="4" fill="none" stroke="#ec4899" strokeWidth="0.6" strokeOpacity="0.4" />
            <circle cx="38" cy="42" r="1.5" fill="#ec4899" opacity="0.6" />
            <circle cx="62" cy="42" r="1.5" fill="#ec4899" opacity="0.6" />
            {/* Nose */}
            <path d="M50 45 L48 55 L52 55 Z" fill="none" stroke="#ec4899" strokeWidth="0.5" strokeOpacity="0.3" />
            {/* Mouth (smile) */}
            <path d="M40 60 Q50 68 60 60" fill="none" stroke="#ec4899" strokeWidth="0.8" strokeOpacity="0.4" />
            {/* Grid lines */}
            {[0, 1, 2, 3].map(i => (
              <line key={`h-${i}`} x1="20" y1={25 + i * 16} x2="80" y2={25 + i * 16} stroke="#ec4899" strokeWidth="0.2" strokeOpacity="0.1" />
            ))}
          </svg>
        </div>

        <h3 className="font-mono text-[10px] text-[#ec4899] tracking-[0.3em] uppercase font-bold mb-4">Mood Analysis</h3>

        {/* Emotion bars */}
        <div className="w-full space-y-2">
          {emotions.map((em) => (
            <div key={em.label} className="flex items-center gap-3">
              <span className="text-[7px] text-white/50 w-12 text-right tracking-wider uppercase">{em.label}</span>
              <div className="flex-1 h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden backdrop-blur-sm">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: em.color,
                    boxShadow: `0 0 8px ${em.color}60`,
                    width: '0%',
                  }}
                  animate={{ width: `${em.value}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[8px] text-white/50 w-8 font-mono">{em.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mood ring */}
      <div className="shrink-0 border-t border-[#ec4899]/15 p-3 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2"
          style={{
            borderColor: '#ec4899',
            background: `conic-gradient(from ${moodRing}deg, #ec4899, #d946ef, #f472b6, #a855f7, #ec4899)`,
            boxShadow: '0 0 15px #ec489960',
          }}
        />
        <div>
          <div className="text-[8px] text-[#ec4899] font-mono tracking-wider">Mood Ring</div>
          <div className="text-[7px] text-white/40 font-mono">Emotional Spectrum Active</div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   10. COMMAND TIMELINE — MEDIEVAL SCROLL UI
   ═══════════════════════════════════════════════════ */

function CommandTimelineView(): React.JSX.Element {
  const messages = useJarvisStore((s) => s.messages)
  const [timelineEntries] = useState(() =>
    messages.slice(-10).map((msg) => ({
      id: msg.id,
      title: msg.content.substring(0, 40) + (msg.content.length > 40 ? '...' : ''),
      type: msg.role === 'user' ? 'decree' as const : 'response' as const,
      timestamp: msg.timestamp,
    }))
  )

  return (
    <div className="h-full flex flex-col min-h-0 font-mono overflow-hidden" style={{ background: '#120c0a' }}>
      {/* Parchment texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Header */}
      <div className="relative z-10 border-b border-[#a16207]/30 px-4 py-3 shrink-0" style={{ background: 'linear-gradient(180deg, #1a120a 0%, transparent 100%)' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📜</span>
          <div>
            <h3 className="text-[10px] text-[#a16207] tracking-[0.2em] uppercase font-bold" style={{ fontFamily: "'Georgia', serif" }}>Royal Command Timeline</h3>
            <p className="text-[7px] text-[#a16207]/50 italic" style={{ fontFamily: "'Georgia', serif" }}>The Chronicle of Decrees & Responses</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-0 min-h-0">
        {/* Vertical line */}
        <div className="absolute left-8 top-0 bottom-0 w-px bg-[#a16207]/15" />

        {timelineEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#a16207]/40 italic" style={{ fontFamily: "'Georgia', serif" }}>
            <span className="text-2xl mb-2">📜</span>
            <p className="text-[10px]">The chronicle lies empty...</p>
            <p className="text-[8px] mt-1">Speak, and your words shall be recorded for posterity.</p>
          </div>
        ) : (
          timelineEntries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative pl-14 pb-5"
            >
              {/* Timeline dot with wax seal */}
              <div
                className="absolute left-6 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: entry.type === 'decree' ? '#a16207' : '#854d0e',
                  backgroundColor: entry.type === 'decree' ? '#a1620730' : '#854d0e20',
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: entry.type === 'decree' ? '#a16207' : '#854d0e' }}
                />
              </div>

              {/* Content */}
              <div
                className="p-3 rounded border-l-2"
                style={{
                  borderLeftColor: entry.type === 'decree' ? '#a16207' : '#854d0e',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: `${entry.type === 'decree' ? '#a16207' : '#854d0e'}20`,
                  background: `${entry.type === 'decree' ? '#a16207' : '#854d0e'}06`,
                }}
              >
                {/* Ribbon banner */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-2 py-0.5 text-[6px] uppercase tracking-[0.3em] font-bold rounded"
                    style={{
                      backgroundColor: entry.type === 'decree' ? '#a1620720' : '#854d0e20',
                      color: entry.type === 'decree' ? '#a16207' : '#854d0e',
                    }}
                  >
                    {entry.type === 'decree' ? '📜 Decree' : '📨 Response'}
                  </span>
                  <span className="text-[7px] text-[#a16207]/40 italic" style={{ fontFamily: "'Georgia', serif" }}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-[9px] leading-relaxed text-white/70" style={{ fontFamily: "'Georgia', serif" }}>
                  {entry.title}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Wax seal stamp */}
      <div className="relative z-10 shrink-0 border-t border-[#a16207]/20 p-3 flex justify-center">
        <div className="flex items-center gap-2 text-[7px] text-[#a16207]/40 italic" style={{ fontFamily: "'Georgia', serif" }}>
          <span>Authenticated by the Royal Astryx Seal</span>
          <span className="text-xs">🔶</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   12. WEATHER STATION — ANEMOMETER & GAUGES UI
   ═══════════════════════════════════════════════════ */

function WeatherStationView(): React.JSX.Element {
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    sendWsMessage('run_tool', { tag: 'WEATHERLAB', content: 'fetch' })
  }, [sendWsMessage])

  useEffect(() => {
    if (!loading || !lastToolResult) return
    if (lastToolResult.tag !== 'WEATHERLAB') return
    try {
      const data = JSON.parse(lastToolResult.result || '{}')
      if (data.type === 'current') setWeather(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [lastToolResult, loading])

  const windSpeed = weather?.wind_speed ?? Math.floor(Math.random() * 30) + 5
  const windDir = weather?.wind_direction ?? Math.floor(Math.random() * 360)
  const temp = weather?.temperature ?? Math.floor(Math.random() * 35) + 5
  const humidity = weather?.humidity ?? Math.floor(Math.random() * 60) + 20
  const pressure = weather?.pressure ?? 980 + Math.floor(Math.random() * 60)
  const city = weather?.city ?? 'Detecting...'
  const emoji = weather?.emoji ?? '🌤️'

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: 'linear-gradient(180deg, #0c1929 0%, #152238 100%)' }}>
      <div className="border-b border-[#38bdf8]/20 px-4 py-3 shrink-0 flex items-center gap-3">
        <span className="text-lg">{emoji}</span>
        <div>
          <h3 className="text-[10px] text-[#38bdf8] tracking-[0.2em] uppercase font-bold">Weather Station</h3>
          <p className="text-[7px] text-[#38bdf8]/50">{loading ? 'FETCHING...' : `${city.toUpperCase()} • LIVE`}</p>
        </div>
        {loading && <div className="w-4 h-4 border-t-2 border-[#38bdf8] rounded-full animate-spin ml-auto" />}
      </div>

      <div className="flex-1 p-4 space-y-5 min-h-0 overflow-y-auto">
        {/* Anemometer */}
        <div className="border border-[#38bdf8]/15 rounded-xl p-5 bg-black/30 flex flex-col items-center">
          <div className="text-[7px] text-[#38bdf8]/60 tracking-widest uppercase mb-3">Wind Speed & Direction</div>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.2" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <line key={deg} x1="50" y1="5" x2="50" y2="10" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.3" transform={`rotate(${deg} 50 50)`} />
              ))}
              <text x="50" y="8" textAnchor="middle" fill="#38bdf8" fontSize="5" strokeOpacity="0.5">N</text>
              <text x="50" y="98" textAnchor="middle" fill="#38bdf8" fontSize="5" strokeOpacity="0.5">S</text>
              <text x="8" y="53" textAnchor="middle" fill="#38bdf8" fontSize="5" strokeOpacity="0.5">W</text>
              <text x="92" y="53" textAnchor="middle" fill="#38bdf8" fontSize="5" strokeOpacity="0.5">E</text>
              <line x1="50" y1="50" x2="50" y2="15" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.8" transform={`rotate(${windDir} 50 50)`} />
              <polygon points="50,12 47,18 53,18" fill="#38bdf8" opacity="0.8" transform={`rotate(${windDir} 50 50)`} />
            </svg>
          </div>
          <div className="mt-3 text-center">
            <span className="text-[22px] text-[#38bdf8] font-bold">{windSpeed}</span>
            <span className="text-[10px] text-[#38bdf8]/60 ml-1">km/h</span>
            <div className="text-[8px] text-white/40 mt-1">Direction: {windDir}°</div>
          </div>
        </div>

        {/* Gauges */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-[#38bdf8]/10 rounded-xl p-3 bg-black/30 text-center">
            <div className="text-[7px] text-[#38bdf8]/60 tracking-wider uppercase mb-2">Temp</div>
            <div className="relative h-16 w-6 mx-auto bg-black/40 rounded-full border border-white/5 overflow-hidden">
              <motion.div className="absolute bottom-0 left-0 right-0 rounded-full" style={{ background: 'linear-gradient(0deg, #38bdf8, #f97316)' }} animate={{ height: `${Math.min((temp / 50) * 100, 100)}%` }} transition={{ duration: 1 }} />
            </div>
            <div className="mt-2"><span className="text-[14px] text-white font-bold">{temp}°</span><span className="text-[8px] text-white/40">C</span></div>
          </div>
          <div className="border border-[#38bdf8]/10 rounded-xl p-3 bg-black/30 text-center">
            <div className="text-[7px] text-[#38bdf8]/60 tracking-wider uppercase mb-2">Humidity</div>
            <svg viewBox="0 0 36 36" className="w-12 h-12 mx-auto">
              <path d="M18 2 L26 16 L10 16 Z" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
              <path d="M18 2 L26 16 L10 16 Z" fill="#38bdf8" stroke="none" opacity={0.2 + humidity / 200} />
            </svg>
            <div className="mt-1"><span className="text-[14px] text-white font-bold">{humidity}</span><span className="text-[8px] text-white/40">%</span></div>
          </div>
          <div className="border border-[#38bdf8]/10 rounded-xl p-3 bg-black/30 text-center">
            <div className="text-[7px] text-[#38bdf8]/60 tracking-wider uppercase mb-2">Pressure</div>
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#38bdf8]/30 flex items-center justify-center">
              <motion.div className="w-8 h-8 rounded-full" style={{ background: `conic-gradient(#38bdf8 0deg, #38bdf8 ${Math.max(0, Math.min(360, ((pressure - 980) / 60) * 360))}deg, transparent ${Math.max(0, Math.min(360, ((pressure - 980) / 60) * 360))}deg)` }} />
            </div>
            <div className="mt-1"><span className="text-[11px] text-white font-bold">{pressure}</span><span className="text-[7px] text-white/40">hPa</span></div>
          </div>
        </div>

        {/* Location & Refresh */}
        <div className="border border-[#38bdf8]/10 rounded-xl p-3 bg-black/30 flex items-center justify-between">
          <div className="text-[8px] text-white/60 tracking-wider">📍 {city}{weather?.country ? `, ${weather.country}` : ''}</div>
          <button
            onClick={() => { audioEngine.playClick(); setLoading(true); sendWsMessage('run_tool', { tag: 'WEATHERLAB', content: 'fetch' }) }}
            className="px-3 py-1 text-[7px] border border-[#38bdf8]/30 text-[#38bdf8] rounded hover:bg-[#38bdf8]/10 transition-all cursor-pointer tracking-wider uppercase"
          >
            REFRESH
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   13. STOCK TICKER — LED TICKER & CANDLESTICK UI
   ═══════════════════════════════════════════════════ */

function StockTickerView(): React.JSX.Element {
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)
  const [stocks, setStocks] = useState<{ symbol: string; price: number; change: number; direction: string }[]>([])
  const [tickerOffset, setTickerOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    sendWsMessage('run_tool', { tag: 'STOCKS', content: 'prices' })
  }, [sendWsMessage])

  useEffect(() => {
    if (!loading || !lastToolResult) return
    if (lastToolResult.tag !== 'STOCKS') return
    try {
      const data = JSON.parse(lastToolResult.result || '{}')
      if (data.type === 'prices') setStocks(data.data || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [lastToolResult, loading])

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerOffset(prev => (prev + 1) % 200)
    }, 80)
    return () => clearInterval(interval)
  }, [])

  const displayStocks = stocks.length > 0 ? stocks : [
    { symbol: 'ASTX', price: 142.35, change: 3.21, direction: 'up' },
    { symbol: 'NVDA', price: 875.44, change: 12.87, direction: 'down' },
    { symbol: 'AAPL', price: 231.08, change: 1.45, direction: 'up' },
    { symbol: 'GOOGL', price: 168.12, change: 0.89, direction: 'down' },
    { symbol: 'TSLA', price: 298.77, change: 8.33, direction: 'up' },
    { symbol: 'MSFT', price: 445.60, change: 2.15, direction: 'up' },
    { symbol: 'AMZN', price: 192.31, change: 1.22, direction: 'down' },
  ]

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#080c08' }}>
      {/* LED Ticker */}
      <div className="shrink-0 bg-[#0a0f0a] border-b border-[#22c55e]/20 overflow-hidden relative h-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#080c08] via-transparent to-[#080c08] z-10" />
        {loading && <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20"><div className="w-3 h-3 border-t border-[#22c55e] rounded-full animate-spin" /></div>}
        <motion.div
          className="flex gap-6 py-2 whitespace-nowrap"
          animate={{ x: -tickerOffset * 8 }}
          transition={{ ease: 'linear', duration: 0.08 }}
        >
          {[...displayStocks, ...displayStocks, ...displayStocks].map((s, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-[9px]">
              <span className="font-bold text-white">{s.symbol}</span>
              <span className="text-white/80">${s.price.toFixed(2)}</span>
              <span className={s.direction === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                {s.direction === 'up' ? '▲' : '▼'} {s.change.toFixed(2)}
              </span>
            </span>
          ))}
        </motion.div>
      </div>

      <div className="flex-1 p-4 space-y-4 min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-[8px] text-[#22c55e]/60 tracking-widest uppercase">{loading ? 'FETCHING...' : `LIVE • ${displayStocks.length} SYMBOLS`}</div>
          <button
            onClick={() => { audioEngine.playClick(); setLoading(true); sendWsMessage('run_tool', { tag: 'STOCKS', content: 'prices' }) }}
            className="px-3 py-1 text-[7px] border border-[#22c55e]/30 text-[#22c55e] rounded hover:bg-[#22c55e]/10 transition-all cursor-pointer tracking-wider uppercase"
          >
            REFRESH
          </button>
        </div>

        {/* Stock Cards */}
        <div className="grid grid-cols-2 gap-2">
          {displayStocks.slice(0, 8).map((s) => (
            <div key={s.symbol} className="border border-[#22c55e]/10 rounded-lg p-3 bg-black/30 flex justify-between items-center">
              <div>
                <div className="text-[9px] font-bold text-white">{s.symbol}</div>
                <div className="text-[7px] text-white/40">NASDAQ</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white font-bold">${s.price.toFixed(2)}</div>
                <div className={`text-[7px] ${s.direction === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {s.direction === 'up' ? '▲' : '▼'} {s.change.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-[#22c55e]/15 p-2 flex justify-center gap-4 text-[6px] tracking-widest">
        <span className="text-[#22c55e]">▲ GREEN = BULLISH</span>
        <span className="text-[#ef4444]">▼ RED = BEARISH</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   14. PARTICLE LAB — PHYSICS SANDBOX UI
   ═══════════════════════════════════════════════════ */

function ParticleLabView(): React.JSX.Element {
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)
  const [particles, setParticles] = useState<any[]>([])
  const [gravity, setGravity] = useState(0.5)
  const [active, setActive] = useState(false)
  const [tick, setTick] = useState(0)
  const [initDone, setInitDone] = useState(false)

  // Initialize particles from backend
  useEffect(() => {
    sendWsMessage('run_tool', { tag: 'PARTICLES', content: 'init|30' })
  }, [sendWsMessage])

  // Handle results
  useEffect(() => {
    if (!lastToolResult || lastToolResult.tag !== 'PARTICLES') return
    try {
      const data = JSON.parse(lastToolResult.result || '{}')
      if (data.type === 'init') {
        setParticles(data.particles || [])
        setInitDone(true)
      } else if (data.type === 'step') {
        setParticles(data.particles || [])
      } else if (data.type === 'gravity') {
        // gravity was set
      }
    } catch { /* ignore */ }
  }, [lastToolResult])

  // Physics simulation — sends steps to backend
  useEffect(() => {
    if (!active || !initDone) return
    const interval = setInterval(() => {
      setTick(prev => (prev + 1) % 1000)
      sendWsMessage('run_tool', { tag: 'PARTICLES', content: `step|${gravity}` })
    }, 100)
    return () => clearInterval(interval)
  }, [active, initDone, gravity, sendWsMessage])

  return (
    <div className="h-full flex flex-col min-h-0 font-mono overflow-hidden" style={{ background: '#0a0510' }}>
      <div className="border-b border-[#f472b6]/20 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">🧪</span>
          <div>
            <h3 className="text-[10px] text-[#f472b6] tracking-[0.2em] uppercase font-bold">Particle Lab</h3>
            <p className="text-[7px] text-[#f472b6]/50">PHYSICS ENGINE • {particles.length} PARTICLES</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[7px] text-white/40 tracking-wider">G: {gravity.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={gravity}
            onChange={(e) => setGravity(parseFloat(e.target.value))}
            className="w-16 h-1 appearance-none bg-[#f472b6]/30 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f472b6]"
          />
          <button
            onClick={() => { audioEngine.playClick(); setActive(!active) }}
            className={`px-3 py-1 rounded border text-[8px] font-bold tracking-wider cursor-pointer ${active ? 'border-[#f472b6] bg-[#f472b6]/15 text-[#f472b6]' : 'border-white/10 text-white/50 hover:text-white'}`}
          >
            {active ? '■ STOP' : '▶ RUN'}
          </button>
        </div>
      </div>

      {/* Particle canvas */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-black/40">
        {particles.map((p) => {
          // Accumulate positions based on tick count for continuous motion
          const driftX = Math.sin(tick * 0.02 + p.id) * 40
          const driftY = Math.cos(tick * 0.03 + p.id * 0.7) * 30 + (active ? tick * gravity * 0.3 : 0)
          const bounceY = Math.sin(tick * 0.05 + p.id * 1.3) * 20
          return (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                boxShadow: `0 0 ${p.size}px ${p.color}60`,
              }}
              animate={{
                x: driftX,
                y: driftY + bounceY,
              }}
              transition={{ type: 'spring', stiffness: 50, damping: 20 }}
            />
          )
        })}
      </div>

      {/* Info bar */}
      <div className="shrink-0 border-t border-[#f472b6]/15 p-2 flex justify-between text-[6px] text-white/40 tracking-wider">
        <span>GRAVITY: {gravity.toFixed(1)} m/s²</span>
        <span>PARTICLES: {particles.length}</span>
        <span>COLLISIONS: ENABLED</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   15. CODE MINIFIER — CRUNCH & COMPRESS UI
   ═══════════════════════════════════════════════════ */

function CodeMinifierView(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [inputSize, setInputSize] = useState(0)
  const [outputSize, setOutputSize] = useState(0)

  const handleMinify = () => {
    audioEngine.playClick()
    const minified = input
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s+/gm, '')
      .replace(/\s+$/gm, '')
      .replace(/\n{2,}/g, '\n')
      .replace(/\s*\{\s*/g, '{')
      .replace(/\s*\}\s*/g, '}')
      .replace(/\s*;\s*/g, ';')
      .replace(/\s*=\s*/g, '=')
      .replace(/\s*,\s*/g, ',')
      .trim()
    setOutput(minified)
    setInputSize(new Blob([input]).size)
    setOutputSize(new Blob([minified]).size)
  }

  const savings = inputSize > 0 ? ((1 - outputSize / inputSize) * 100).toFixed(1) : '0'

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#0d0806' }}>
      <div className="border-b border-[#f97316]/20 px-4 py-3 shrink-0 flex items-center gap-3">
        <span className="text-lg">🗜️</span>
        <div>
          <h3 className="text-[10px] text-[#f97316] tracking-[0.2em] uppercase font-bold">Code Minifier</h3>
          <p className="text-[7px] text-[#f97316]/50">CRUNCH • COMPRESS • OPTIMIZE</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3 min-h-0 overflow-y-auto">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste code to minify..."
          rows={4}
          className="w-full bg-black/40 border border-[#f97316]/20 rounded-lg p-3 text-[10px] text-[#f97316]/80 font-mono focus:outline-none focus:border-[#f97316]/40 resize-none placeholder-white/20 leading-relaxed"
        />

        <button
          onClick={handleMinify}
          disabled={!input.trim()}
          className="w-full py-2 rounded-lg text-[9px] font-bold tracking-widest uppercase border disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          style={{ borderColor: '#f9731640', backgroundColor: '#f9731612', color: '#f97316' }}
        >
          ⚡ CRUNCH
        </button>

        {/* Size gauges */}
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-[#f97316]/10 rounded-lg p-3 bg-black/30 text-center">
            <div className="text-[18px] text-[#f97316] font-bold">{inputSize}</div>
            <div className="text-[7px] text-white/40 tracking-wider">INPUT BYTES</div>
          </div>
          <div className="border border-[#f97316]/10 rounded-lg p-3 bg-black/30 text-center">
            <div className="text-[18px] text-[#34d399] font-bold">{outputSize}</div>
            <div className="text-[7px] text-white/40 tracking-wider">OUTPUT BYTES</div>
          </div>
          <div className="border border-[#f97316]/10 rounded-lg p-3 bg-black/30 text-center">
            <div className="text-[18px] text-[#fbbf24] font-bold">{savings}%</div>
            <div className="text-[7px] text-white/40 tracking-wider">COMPRESSION</div>
          </div>
        </div>

        {/* Compression bar */}
        {inputSize > 0 && (
          <div className="h-2 bg-black/40 rounded-full border border-[#f97316]/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #34d399)' }}
              animate={{ width: `${outputSize / inputSize * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}

        {/* Output */}
        {output && (
          <div className="border border-[#f97316]/15 rounded-xl p-3 bg-black/30">
            <div className="text-[7px] text-[#34d399]/60 tracking-widest uppercase mb-2 flex items-center gap-2">
              <span>✓ MINIFIED OUTPUT</span>
              <button
                onClick={() => { navigator.clipboard.writeText(output); audioEngine.playSuccess() }}
                className="px-2 py-0.5 text-[7px] border border-[#34d399]/30 text-[#34d399] rounded cursor-pointer hover:bg-[#34d399]/10"
              >
                COPY
              </button>
            </div>
            <pre className="text-[9px] text-[#f97316]/70 font-mono whitespace-pre-wrap leading-relaxed select-text max-h-32 overflow-y-auto">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   16. LANGUAGE TRANSLATOR — PASSPORT STAMP UI
   ═══════════════════════════════════════════════════ */

function TranslatorView(): React.JSX.Element {
  const [text, setText] = useState('')
  const [fromLang, setFromLang] = useState('en')
  const [toLang, setToLang] = useState('es')
  const [translated, setTranslated] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  ]

  const handleTranslate = () => {
    if (!text.trim() || isTranslating) return
    audioEngine.playClick()
    setIsTranslating(true)
    setTranslated('')
    sendWsMessage('run_tool', { tag: 'TRANSLATE', content: `${text}|${toLang}` })
  }

  // Translation result handler
  useEffect(() => {
    if (!isTranslating || !lastToolResult) return
    if (lastToolResult.tag !== 'TRANSLATE') return
    setIsTranslating(false)
    setTranslated(lastToolResult.result || 'Translation complete.')
  }, [lastToolResult, isTranslating])

  // Timeout: reset after 15s if no response
  useEffect(() => {
    if (!isTranslating) return
    const timeout = setTimeout(() => {
      setIsTranslating(false)
      setTranslated('⏱ Translation timed out. Check backend connection and try again.')
    }, 15000)
    return () => clearTimeout(timeout)
  }, [isTranslating])

  const swapLangs = () => {
    audioEngine.playClick()
    setFromLang(toLang)
    setToLang(fromLang)
    setText(translated)
    setTranslated(text)
  }

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#0c0818' }}>
      {/* Passport header */}
      <div className="border-b-2 border-[#818cf8]/20 px-4 py-3 shrink-0 flex items-center gap-3" style={{ borderStyle: 'double' }}>
        <span className="text-lg">🌐</span>
        <div>
          <h3 className="text-[10px] text-[#818cf8] tracking-[0.2em] uppercase font-bold">World Translator</h3>
          <p className="text-[7px] text-[#818cf8]/50">PASSPORT • MULTILINGUAL • DIPLOMATIC</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3 min-h-0 overflow-y-auto">
        {/* Language Selectors */}
        <div className="flex items-center gap-2">
          <select
            value={fromLang}
            onChange={(e) => setFromLang(e.target.value)}
            className="flex-1 bg-black/40 border border-[#818cf8]/20 rounded-lg px-3 py-2 text-[9px] text-white focus:outline-none focus:border-[#818cf8]/40 cursor-pointer"
          >
            {languages.map(l => (
              <option key={l.code} value={l.code} className="bg-[#0c0818]">{l.flag} {l.name}</option>
            ))}
          </select>

          <button
            onClick={swapLangs}
            className="w-8 h-8 rounded-full border border-[#818cf8]/30 flex items-center justify-center text-[#818cf8] hover:bg-[#818cf8]/10 transition-all cursor-pointer shrink-0"
          >
            ⇄
          </button>

          <select
            value={toLang}
            onChange={(e) => setToLang(e.target.value)}
            className="flex-1 bg-black/40 border border-[#818cf8]/20 rounded-lg px-3 py-2 text-[9px] text-white focus:outline-none focus:border-[#818cf8]/40 cursor-pointer"
          >
            {languages.map(l => (
              <option key={l.code} value={l.code} className="bg-[#0c0818]">{l.flag} {l.name}</option>
            ))}
          </select>
        </div>

        {/* Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to translate..."
          rows={3}
          className="w-full bg-black/40 border border-[#818cf8]/20 rounded-lg p-3 text-[10px] text-white/90 focus:outline-none focus:border-[#818cf8]/40 resize-none placeholder-white/20"
        />

        <button
          onClick={handleTranslate}
          disabled={!text.trim() || isTranslating}
          className="w-full py-2 rounded-lg text-[9px] font-bold tracking-widest uppercase border disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          style={{ borderColor: '#818cf840', backgroundColor: '#818cf812', color: '#818cf8' }}
        >
          {isTranslating ? '⟳ TRANSLATING...' : '🌍 TRANSLATE'}
        </button>

        {/* Output */}
        {translated && (
          <div className="relative border-2 border-[#818cf8]/20 rounded-xl p-4 bg-black/30" style={{ borderStyle: 'double' }}>
            {/* Passport stamp */}
            <div className="absolute -top-2 -right-2 w-10 h-10 rotate-12 opacity-60 select-none">
              <div className="w-full h-full rounded-full border-2 border-[#818cf8]/40 flex items-center justify-center text-[14px]">
                {languages.find(l => l.code === toLang)?.flag || '🌐'}
              </div>
            </div>
            <div className="text-[7px] text-[#818cf8]/60 tracking-widest uppercase mb-2">
              {languages.find(l => l.code === toLang)?.name || 'TRANSLATED'} OUTPUT
            </div>
            <p className="text-[11px] text-white/90 leading-relaxed select-text">{translated}</p>
            <div className="mt-2 pt-2 border-t border-[#818cf8]/10 text-[6px] text-[#818cf8]/40 tracking-wider italic">
              Verified by the Astryx Diplomatic Service
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   17. MISSION CONTROL — FEATURE ROADMAP DASHBOARD
   ═══════════════════════════════════════════════════ */

function MissionControlView(): React.JSX.Element {
  const categories = [
    {
      id: 'agents',
      name: '🤖 Autonomous Agents',
      progress: 35,
      color: '#a78bfa',
      features: [
        { name: 'Agent Framework (Base)', done: true },
        { name: 'Dynamic Agent Creation', done: true },
        { name: 'Multi-Agent Orchestration', done: true },
        { name: 'Executive Assistant', done: true },
        { name: 'Self-Learning Optimization', done: false },
        { name: 'AI Initiative Mode', done: false },
        { name: 'Agent Marketplace', done: false },
        { name: 'Predict User Actions', done: false },
      ],
    },
    {
      id: 'os',
      name: '🖥️ AI Operating System',
      progress: 20,
      color: '#00e5ff',
      features: [
        { name: 'Desktop Overlay', done: true },
        { name: 'Floating AI Assistant', done: true },
        { name: 'Global Command Palette', done: false },
        { name: 'AI-Powered Start Menu', done: false },
        { name: 'AI File Explorer', done: false },
        { name: 'Window Manager', done: false },
        { name: 'Workspace Saving', done: false },
        { name: 'Multi-Monitor Control', done: false },
      ],
    },
    {
      id: 'vision',
      name: '👁️ Computer Vision',
      progress: 15,
      color: '#22c55e',
      features: [
        { name: 'Screen Analysis', done: true },
        { name: 'Face Detection', done: true },
        { name: 'UI Element Understanding', done: false },
        { name: 'Gesture Control', done: false },
        { name: 'Eye Tracking', done: false },
        { name: 'Whiteboard Recognition', done: false },
        { name: 'Object Tracking', done: false },
      ],
    },
    {
      id: 'automation',
      name: '🤖 Computer Automation',
      progress: 25,
      color: '#f97316',
      features: [
        { name: 'Shell Command Execution', done: true },
        { name: 'File Operations', done: true },
        { name: 'Browser Control', done: false },
        { name: 'Office Automation', done: false },
        { name: 'Photoshop Automation', done: false },
        { name: 'VS Code Automation', done: false },
        { name: 'Docker Management', done: true },
        { name: 'CI/CD Pipeline', done: false },
      ],
    },
    {
      id: 'internet',
      name: '🌐 Internet Intelligence',
      progress: 30,
      color: '#3b82f6',
      features: [
        { name: 'Web Search', done: true },
        { name: 'Deep Research', done: true },
        { name: 'Multi-Source Analysis', done: false },
        { name: 'Auto Citation', done: false },
        { name: 'Fake News Detection', done: false },
        { name: 'Trend Prediction', done: true },
        { name: 'Competitor Analysis', done: false },
      ],
    },
    {
      id: 'productivity',
      name: '💼 Productivity 2.0',
      progress: 25,
      color: '#fbbf24',
      features: [
        { name: 'Memory Core', done: true },
        { name: 'Knowledge Graph', done: true },
        { name: 'Smart Note Linking', done: false },
        { name: 'Daily Intelligence Report', done: false },
        { name: 'Meeting Assistant', done: true },
        { name: 'Smart Calendar', done: false },
        { name: 'Email Intelligence', done: false },
      ],
    },
    {
      id: 'dev',
      name: '💻 Software Development',
      progress: 40,
      color: '#10b981',
      features: [
        { name: 'Code Explainer', done: true },
        { name: 'Code Sandbox', done: true },
        { name: 'Code Review', done: true },
        { name: 'Code Generation', done: false },
        { name: 'AI Pair Programming', done: false },
        { name: 'Security Scanning', done: false },
        { name: 'Auto Documentation', done: false },
      ],
    },
    {
      id: 'creative',
      name: '🎨 Creative AI Studio',
      progress: 20,
      color: '#ec4899',
      features: [
        { name: 'Image Generation', done: true },
        { name: 'PPT Generator', done: true },
        { name: 'Dashboard Generator', done: true },
        { name: 'Video Editor', done: false },
        { name: 'Music Composer', done: false },
        { name: 'Voice Actor', done: false },
        { name: 'Animation Studio', done: false },
      ],
    },
    {
      id: 'smart',
      name: '🏠 Smart Environment',
      progress: 15,
      color: '#38bdf8',
      features: [
        { name: 'IoT Dashboard', done: true },
        { name: 'Smart Home Control', done: true },
        { name: 'ESP32 Integration', done: false },
        { name: 'Security Cameras', done: false },
        { name: 'Robot Control', done: true },
        { name: 'Energy Optimization', done: false },
      ],
    },
    {
      id: 'enterprise',
      name: '🔐 Enterprise Security',
      progress: 20,
      color: '#ef4444',
      features: [
        { name: 'Encryption', done: true },
        { name: 'Admin Mode', done: true },
        { name: 'Audit Trail', done: true },
        { name: 'Zero Trust', done: false },
        { name: 'Secure Sandbox', done: false },
        { name: 'Compliance Dashboard', done: false },
        { name: 'Device Risk Analysis', done: false },
      ],
    },
    {
      id: 'future',
      name: '🧬 Future AI',
      progress: 10,
      color: '#c084fc',
      features: [
        { name: 'Digital Twin', done: false },
        { name: 'Continuous Learning', done: false },
        { name: 'Multi-Modal Reasoning', done: true },
        { name: 'Dynamic Model Routing', done: true },
        { name: 'Plugin Ecosystem', done: false },
        { name: 'Explainable AI', done: false },
      ],
    },
    {
      id: 'premium',
      name: '🚀 Ultra Premium',
      progress: 5,
      color: '#f59e0b',
      features: [
        { name: '3D Holographic Avatar', done: false },
        { name: 'Spatial UI', done: false },
        { name: 'VR/AR Support', done: false },
        { name: 'Voice-First Interface', done: true },
        { name: 'Brain-Computer Interface', done: false },
        { name: 'Floating Widgets', done: true },
      ],
    },
  ]

  const totalFeatures = categories.reduce((sum, c) => sum + c.features.length, 0)
  const doneFeatures = categories.reduce((sum, c) => sum + c.features.filter(f => f.done).length, 0)
  const overallProgress = Math.round((doneFeatures / totalFeatures) * 100)

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="h-full flex flex-col min-h-0 font-mono" style={{ background: '#050a15' }}>
      {/* Header */}
      <div className="border-b border-[#00e5ff]/20 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">🚀</span>
            <div>
              <h3 className="text-[10px] text-[#00e5ff] tracking-[0.2em] uppercase font-bold">Mission Control</h3>
              <p className="text-[7px] text-[#00e5ff]/50">Feature Roadmap Dashboard</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[18px] text-white font-bold">{overallProgress}%</div>
            <div className="text-[6px] text-white/30 tracking-wider uppercase">Complete</div>
          </div>
        </div>
        {/* Overall progress bar */}
        <div className="mt-2 h-1.5 bg-black/40 rounded-full border border-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #00e5ff, #a78bfa, #ec4899)' }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[6px] text-white/30 tracking-wider">
          <span>{doneFeatures} Features Complete</span>
          <span className="text-[#00e5ff]/60">{totalFeatures - doneFeatures} Remaining</span>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {categories.map((cat) => {
          const isExpanded = expandedCategory === cat.id
          return (
            <div
              key={cat.id}
              className="border rounded-lg overflow-hidden transition-all duration-300"
              style={{ borderColor: `${cat.color}25` }}
            >
              {/* Category header */}
              <button
                onClick={() => {
                  audioEngine.playClick()
                  setExpandedCategory(isExpanded ? null : cat.id)
                }}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                style={{ backgroundColor: `${cat.color}08` }}
              >
                <span className="text-sm">{cat.name.split(' ')[0]}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/90 font-bold tracking-wider">{cat.name}</span>
                    <span className="text-[9px] font-bold" style={{ color: cat.color }}>{cat.progress}%</span>
                  </div>
                  <div className="mt-1 h-1 bg-black/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.progress}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                    />
                  </div>
                </div>
                <span className={`text-[8px] text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Feature list */}
              {isExpanded && (
                <div className="border-t border-white/5 p-2 space-y-0.5">
                  {cat.features.map((feat) => (
                    <div key={feat.name} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.02]">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${feat.done ? '' : 'border border-white/20'}`}
                        style={{ backgroundColor: feat.done ? cat.color : 'transparent' }}
                      >
                        {feat.done && <span className="text-[6px] text-black font-bold">✓</span>}
                      </div>
                      <span className={`text-[8px] ${feat.done ? 'text-white/70' : 'text-white/40'}`}>
                        {feat.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#00e5ff]/10 p-2 text-center text-[6px] text-white/20 tracking-wider">
        MISSION CONTROL v1.0 • LAST UPDATED: {new Date().toLocaleDateString()}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   18. AGENT FORGE — AUTONOMOUS AGENT LAUNCHPAD
   ═══════════════════════════════════════════════════ */

function AgentForgeView(): React.JSX.Element {
  const [agents, setAgents] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'launchpad' | 'multi' | 'assistant'>('launchpad')
  const [task, setTask] = useState('')
  const [result, setResult] = useState('')
  const [running, setRunning] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentRole, setNewAgentRole] = useState('')
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)

  // Request agent list on mount
  useEffect(() => {
    sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: 'list' })
  }, [sendWsMessage])

  // Handle results from backend
  useEffect(() => {
    if (!lastToolResult || lastToolResult.tag !== 'AGENTFORGE') return
    try {
      const data = JSON.parse(lastToolResult.result || '{}')
      if (data.type === 'agent_list') {
        setAgents(data.agents || [])
      } else if (data.type === 'multi_agent_result' || data.type === 'delegation_result') {
        setResult(data.result || JSON.stringify(data, null, 2))
        setRunning(false)
        // Refresh agent list
        sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: 'list' })
      } else if (data.type === 'agent_created') {
        setNewAgentName('')
        setNewAgentRole('')
        sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: 'list' })
      } else if (data.type === 'suggestions') {
        setResult(JSON.stringify(data.suggestions || [], null, 2))
        setRunning(false)
      }
    } catch { /* ignore */ }
  }, [lastToolResult, sendWsMessage])

  const handleRunTask = () => {
    if (!task.trim() || running) return
    audioEngine.playClick()
    setRunning(true)
    setResult('')
    sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: `run|${task}|3` })
  }

  const handleCreateAgent = () => {
    if (!newAgentName.trim() || !newAgentRole.trim()) return
    audioEngine.playClick()
    sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: `create|${newAgentName.trim()}|${newAgentRole.trim()}` })
  }

  const handleGetSuggestions = () => {
    audioEngine.playClick()
    setRunning(true)
    setResult('')
    sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: 'suggest|force' })
  }

  const handleDelegate = (agentName: string) => {
    if (!task.trim()) return
    audioEngine.playClick()
    setRunning(true)
    setResult('')
    sendWsMessage('run_tool', { tag: 'AGENTFORGE', content: `delegate|${agentName}|${task}` })
  }

  return (
    <div className="h-full flex flex-col min-h-0 font-mono overflow-hidden" style={{ background: '#0c0818' }}>
      {/* Header */}
      <div className="border-b border-[#a78bfa]/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">🤖</span>
          <div>
            <h3 className="text-[10px] text-[#a78bfa] tracking-[0.2em] uppercase font-bold">Agent Forge</h3>
            <p className="text-[7px] text-[#a78bfa]/50">AUTONOMOUS AGENT LAUNCHPAD • {agents.length} AGENTS</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-2">
          {[
            { id: 'launchpad' as const, label: '🚀 Launchpad', desc: 'Run & delegate tasks' },
            { id: 'multi' as const, label: '🤝 Multi-Agent', desc: 'Full orchestration' },
            { id: 'assistant' as const, label: '💡 Assistant', desc: 'Proactive suggestions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { audioEngine.playClick(); setActiveTab(tab.id) }}
              className={`flex-1 px-2 py-1.5 rounded text-[7px] font-bold tracking-wider border transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#a78bfa]/40 bg-[#a78bfa]/10 text-[#a78bfa]'
                  : 'border-white/5 text-white/40 hover:text-white hover:border-white/15'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {activeTab === 'launchpad' && (
          <>
            {/* Agent Grid */}
            <div className="text-[7px] text-[#a78bfa]/60 tracking-widest uppercase mb-1">Available Agents</div>
            <div className="grid grid-cols-2 gap-2">
              {agents.map((agent) => (
                <div
                  key={agent.name}
                  className="border border-[#a78bfa]/10 rounded-lg p-2.5 bg-black/30 hover:border-[#a78bfa]/30 transition-all"
                >
                  <div className="text-[8px] text-white font-bold truncate">{agent.name}</div>
                  <div className="text-[6.5px] text-white/40 truncate mt-0.5">{agent.role}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[6px] text-white/30">
                    <span>Tasks: {agent.task_count}</span>
                    <span>✓ {agent.success_count}</span>
                  </div>
                  <button
                    onClick={() => handleDelegate(agent.name)}
                    disabled={running || !task.trim()}
                    className="w-full mt-1.5 py-1 text-[6px] font-bold tracking-wider border border-[#a78bfa]/20 text-[#a78bfa] rounded hover:bg-[#a78bfa]/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed uppercase"
                  >
                    DELEGATE
                  </button>
                </div>
              ))}
            </div>

            {/* Task input */}
            <div className="text-[7px] text-[#a78bfa]/60 tracking-widest uppercase mt-2">Task</div>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe a task for an agent or multi-agent team..."
              rows={2}
              className="w-full bg-black/40 border border-[#a78bfa]/20 rounded-lg p-2 text-[9px] text-white/90 focus:outline-none focus:border-[#a78bfa]/40 resize-none placeholder-white/20"
            />

            {/* Create agent */}
            <div className="border border-[#a78bfa]/10 rounded-lg p-3 bg-black/30 space-y-2">
              <div className="text-[7px] text-[#a78bfa]/60 tracking-widest uppercase">Create Custom Agent</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Agent name..."
                  className="flex-1 bg-black/40 border border-[#a78bfa]/20 rounded px-2 py-1 text-[8px] text-white focus:outline-none focus:border-[#a78bfa]/40"
                />
                <input
                  type="text"
                  value={newAgentRole}
                  onChange={(e) => setNewAgentRole(e.target.value)}
                  placeholder="Role..."
                  className="flex-1 bg-black/40 border border-[#a78bfa]/20 rounded px-2 py-1 text-[8px] text-white focus:outline-none focus:border-[#a78bfa]/40"
                />
                <button
                  onClick={handleCreateAgent}
                  disabled={!newAgentName.trim() || !newAgentRole.trim()}
                  className="px-3 py-1 text-[7px] font-bold border border-[#a78bfa]/30 text-[#a78bfa] rounded hover:bg-[#a78bfa]/10 transition-all cursor-pointer disabled:opacity-30 uppercase"
                >
                  CREATE
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'multi' && (
          <>
            <div className="border border-[#a78bfa]/15 rounded-lg p-3 bg-black/30 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[#a78bfa]">🤝</span>
                <span className="text-[9px] text-white font-bold tracking-wider">Multi-Agent Orchestration</span>
              </div>
              <p className="text-[7px] text-white/40 leading-relaxed">
                Decomposes your task into sub-tasks, delegates to the best-suited agents, synthesizes results, and reviews the final output.
              </p>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe a complex task that needs multiple specialist agents..."
                rows={3}
                className="w-full bg-black/40 border border-[#a78bfa]/20 rounded-lg p-2 text-[9px] text-white/90 focus:outline-none focus:border-[#a78bfa]/40 resize-none placeholder-white/20"
              />
              <button
                onClick={handleRunTask}
                disabled={!task.trim() || running}
                className="w-full py-2 rounded text-[8px] font-bold tracking-widest uppercase border disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
                style={{ borderColor: '#a78bfa40', backgroundColor: '#a78bfa12', color: '#a78bfa' }}
              >
                {running ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-t border-[#a78bfa] rounded-full animate-spin" />
                    ORCHESTRATING AGENTS...
                  </span>
                ) : '🚀 LAUNCH MULTI-AGENT MISSION'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'assistant' && (
          <>
            <div className="border border-[#a78bfa]/15 rounded-lg p-3 bg-black/30 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[#a78bfa]">💡</span>
                <span className="text-[9px] text-white font-bold tracking-wider">Executive Assistant</span>
              </div>
              <p className="text-[7px] text-white/40 leading-relaxed">
                Proactive, context-aware assistant that generates suggestions based on time of day, system state, and your activity patterns.
              </p>
              <button
                onClick={handleGetSuggestions}
                disabled={running}
                className="w-full py-2 rounded text-[8px] font-bold tracking-widest uppercase border disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
                style={{ borderColor: '#a78bfa40', backgroundColor: '#a78bfa12', color: '#a78bfa' }}
              >
                {running ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-t border-[#a78bfa] rounded-full animate-spin" />
                    ANALYZING CONTEXT...
                  </span>
                ) : '💡 GET PROACTIVE SUGGESTIONS'}
              </button>
            </div>
          </>
        )}

        {/* Result output */}
        {result && (
          <div className="border border-[#a78bfa]/15 rounded-lg p-3 bg-black/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[7px] text-[#a78bfa]/60 tracking-widest uppercase">Result</span>
              <button
                onClick={() => { navigator.clipboard.writeText(result); audioEngine.playSuccess() }}
                className="px-2 py-0.5 text-[6px] border border-[#a78bfa]/20 text-[#a78bfa] rounded cursor-pointer hover:bg-[#a78bfa]/10"
              >
                COPY
              </button>
            </div>
            <pre className="text-[8px] text-white/70 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto select-text">
              {result}
            </pre>
          </div>
        )}
      </div>

      {/* Agent count footer */}
      <div className="shrink-0 border-t border-[#a78bfa]/10 p-2 flex justify-between text-[6px] text-white/30 tracking-wider">
        <span>{agents.length} Active Agents</span>
        <span>7 Pre-built • Customizable</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   11. SYNTHWAVE EQUALIZER — 80s NEON UI
   ═══════════════════════════════════════════════════ */

function SynthwaveEqualizerView(): React.JSX.Element {
  const [bands, setBands] = useState(() =>
    Array.from({ length: 10 }, () => 50 + Math.random() * 50)
  )
  const [active, setActive] = useState(false)

  return (
    <div className="h-full flex flex-col min-h-0 font-mono overflow-hidden select-none relative" style={{ background: 'linear-gradient(180deg, #0d0221 0%, #1a0533 30%, #0d0221 100%)' }}>
      {/* Synthwave sun */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-16">
        <div
          className="w-full h-full rounded-t-full"
          style={{
            background: 'linear-gradient(180deg, #d946ef 0%, #f97316 50%, #fbbf24 100%)',
            boxShadow: '0 0 60px #d946ef60, 0 0 120px #f9731640',
          }}
        />
      </div>

      {/* Horizon grid */}
      <div
        className="absolute top-[72px] left-0 right-0 h-24"
        style={{
          background: `repeating-linear-gradient(0deg,
            transparent 0px, transparent 11px,
            rgba(217, 70, 239, 0.08) 11px, rgba(217, 70, 239, 0.08) 12px
          )`,
          perspective: '400px',
          transform: 'rotateX(60deg)',
          transformOrigin: 'top center',
        }}
      />

      {/* Equalizer */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-4 pb-6">
        <div className="text-center mb-4">
          <h3 className="text-[11px] text-[#d946ef] tracking-[0.3em] uppercase font-bold" style={{ textShadow: '0 0 20px #d946ef80' }}>
            Synthwave EQ
          </h3>
          <p className="text-[7px] text-[#d946ef]/40 tracking-wider mt-1">10-BAND GRAPHIC EQUALIZER</p>
        </div>

        {/* EQ Bars */}
        <div className="flex items-end gap-2 h-32 mb-4">
          {Array.from({ length: 10 }, (_, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t-sm relative"
              style={{
                background: `linear-gradient(0deg, #d946ef, #f97316)`,
                boxShadow: '0 0 12px #d946ef40',
              }}
              animate={{
                height: active ? `${20 + Math.random() * 80}%` : '30%',
              }}
              transition={{ duration: 0.15 }}
            >
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[6px] text-[#d946ef]/50">
                {[63, 125, 250, 500, '1k', '2k', '4k', '8k', '16k', '32k'][i]}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => { audioEngine.playClick(); setActive(!active) }}
            className={`px-5 py-2 rounded border text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-all ${
              active
                ? 'border-[#d946ef] bg-[#d946ef]/15 text-[#d946ef] animate-pulse shadow-[0_0_20px_rgba(217,70,239,0.3)]'
                : 'border-[#d946ef]/30 text-[#d946ef]/60 hover:text-[#d946ef] hover:border-[#d946ef]/60'
            }`}
          >
            {active ? '■ STOP' : '▶ PLAY'}
          </button>

          {/* Sliders */}
          <div className="flex gap-3 items-center">
            {['VOL', 'BASS', 'TREB'].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="70"
                  className="w-16 h-1 appearance-none bg-[#d946ef]/30 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#d946ef] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(217,70,239,0.8)]"
                  style={{ transform: 'rotate(-90deg)' }}
                />
                <span className="text-[6px] text-[#d946ef]/60 tracking-widest">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chrome footer */}
      <div className="relative z-10 shrink-0 border-t border-[#d946ef]/15 p-2 text-center text-[6px] text-[#d946ef]/30 tracking-[0.4em] uppercase">
        PURE ANALOG • 1986
      </div>
    </div>
  )
}

/* ═══════════════════ SPATIAL WALL MAPPER VIEW ═══════════════════ */

function WallMapperView(): React.JSX.Element {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([
    '[SYS] AR Spatial Mapper initialized.',
    '[SYS] Awaiting camera connection direct input...'
  ])
  const [wallPoints, setWallPoints] = useState<{x: number, y: number}[]>([
    { x: 120, y: 140 },
    { x: 480, y: 100 },
    { x: 520, y: 360 },
    { x: 100, y: 380 }
  ])
  const [activePoint, setActivePoint] = useState<number | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const setOrbState = useJarvisStore((s) => s.setOrbState)

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-6))
  }

  // Connect webcam stream
  const startCamera = async () => {
    try {
      addLog('Accessing webcam visual input...')
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      addLog('Optical sensor array online.')
    } catch (e) {
      addLog('CRITICAL: Camera permission denied or device busy.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    addLog('Optical sensor array disconnected.')
  }

  useEffect(() => {
    setOrbState('ar_mode')
    startCamera()
    return () => {
      stopCamera()
      setOrbState('standby')
    }
  }, [])

  // Scanning loop simulation
  useEffect(() => {
    if (!scanning) return
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer)
          setScanning(false)
          addLog('Spatial wall mapping telemetry lock established.')
          audioEngine.playSuccess()
          return 100
        }
        if (prev % 15 === 0) {
          addLog(`Scanning coordinates... Y-axis sweep: ${prev}%`)
        }
        return prev + 2
      })
    }, 80)
    return () => clearInterval(timer)
  }, [scanning])

  const triggerScan = () => {
    if (scanning) return
    audioEngine.playElevate()
    setScanning(true)
    setProgress(0)
    addLog('Triggering laser LiDAR coordinate scan...')
  }

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animFrame = 0

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw grid overlays
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)'
      ctx.lineWidth = 0.5
      const gridSize = 30
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // Draw connection vectors (Wall wireframe outline)
      ctx.strokeStyle = scanning ? 'rgba(0, 229, 255, 0.4)' : 'rgba(0, 229, 255, 0.75)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 2])
      ctx.beginPath()
      ctx.moveTo(wallPoints[0].x, wallPoints[0].y)
      for (let i = 1; i < wallPoints.length; i++) {
        ctx.lineTo(wallPoints[i].x, wallPoints[i].y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])

      // Fill with transparent mesh
      ctx.fillStyle = 'rgba(0, 229, 255, 0.05)'
      ctx.fill()

      // Draw radar target sweep lines if scanning
      if (scanning) {
        const sweepY = (progress / 100) * canvas.height
        ctx.strokeStyle = '#00e5ff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, sweepY)
        ctx.lineTo(canvas.width, sweepY)
        ctx.stroke()

        // Scan bloom
        const grad = ctx.createLinearGradient(0, sweepY - 30, 0, sweepY)
        grad.addColorStop(0, 'rgba(0,229,255,0)')
        grad.addColorStop(1, 'rgba(0,229,255,0.25)')
        ctx.fillStyle = grad
        ctx.fillRect(0, sweepY - 30, canvas.width, 30)
      }

      // Draw vector point anchors
      wallPoints.forEach((pt, i) => {
        ctx.fillStyle = activePoint === i ? '#ffffff' : '#00e5ff'
        ctx.strokeStyle = '#006688'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Point label coords
        ctx.fillStyle = '#00e5ff'
        ctx.font = '7px Courier New'
        ctx.fillText(`P${i}[${Math.round(pt.x)}, ${Math.round(pt.y)}]`, pt.x + 10, pt.y - 5)
      })

      // Telemetry targets
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

      animFrame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animFrame)
  }, [wallPoints, scanning, progress, activePoint])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find clicked point anchor
    const clickRadius = 15
    const idx = wallPoints.findIndex((pt) => {
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2)
      return dist < clickRadius
    })

    if (idx !== -1) {
      setActivePoint(idx)
      audioEngine.playHover()
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activePoint === null || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(canvasRef.current.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(canvasRef.current.height, e.clientY - rect.top))

    setWallPoints((prev) => {
      const copy = [...prev]
      copy[activePoint] = { x, y }
      return copy
    })
  }

  const handleMouseUp = () => {
    if (activePoint !== null) {
      addLog(`Corner anchor P${activePoint} recalibrated.`)
      setActivePoint(null)
    }
  }

  const handleSaveMesh = () => {
    audioEngine.playSuccess()
    const meshJSON = JSON.stringify({
      session: crypto.randomUUID(),
      timestamp: Date.now(),
      planes: [
        { name: 'Primary Front Wall', anchorPoints: wallPoints }
      ]
    }, null, 2)
    addLog('Room spatial mesh exported successfully.')
    alert(`Spatial Mesh Exported:\n\n${meshJSON}`)
  }

  return (
    <div className="panel-luxury p-5 grid grid-cols-1 md:grid-cols-3 gap-6 bg-black/60 border border-astryx-border select-none">
      {/* Visual camera feed and canvas overlay */}
      <div className="md:col-span-2 relative aspect-[4/3] w-full rounded border border-white/10 overflow-hidden bg-black/80 flex items-center justify-center shadow-inner">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-55 saturate-50 contrast-125 hue-rotate-15"
          />
        ) : (
          <div className="text-center font-mono text-[9px] text-white/30 tracking-widest uppercase">
            [Awaiting Sensor Visual Signal]
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute inset-0 w-full h-full cursor-crosshair z-10 pointer-events-auto"
        />
        {/* Neon warning scan indicator */}
        <div className="absolute top-3 left-3 bg-red-950/60 border border-red-500/40 text-red-400 font-mono text-[7px] px-2 py-0.5 tracking-wider rounded z-20 flex items-center gap-1.5 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>LIDAR EMITTER SCAN ONLINE</span>
        </div>
      </div>

      {/* Control panel and logs */}
      <div className="flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="font-display text-sm tracking-wider text-white">SPATIAL RADAR MODULE</h3>
            <p className="font-mono text-[8px] text-white/50 tracking-wider">
              AR room plane mesh and boundary mapping system.
            </p>
          </div>

          {/* Interactive controls */}
          <div className="space-y-2.5">
            <button
              onClick={triggerScan}
              disabled={scanning}
              className={`w-full py-2 rounded text-center text-[10px] font-mono tracking-widest uppercase border transition-all cursor-pointer ${
                scanning
                  ? 'border-white/10 bg-white/5 text-white/30'
                  : 'border-astryx-cyan/40 bg-astryx-cyan/10 text-astryx-cyan hover:bg-astryx-cyan/20'
              }`}
            >
              {scanning ? `SCANNING ${progress}%...` : 'START LASER SCAN'}
            </button>
            <button
              onClick={handleSaveMesh}
              disabled={scanning}
              className="w-full py-2 rounded text-center text-[10px] font-mono tracking-widest uppercase border border-white/10 bg-white/5 text-white/80 hover:bg-white/15 transition-all cursor-pointer"
            >
              SAVE EXPORTED MESH
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between font-mono text-[8px] text-white/40 tracking-wider">
              <span>SCAN DEPTH READOUT</span>
              <span>1.84m Avg</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-astryx-cyan"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        </div>

        {/* Telemetry logs block */}
        <div className="panel-luxury bg-black/40 border border-white/5 p-3 rounded space-y-2 h-[120px] overflow-hidden">
          <div className="font-mono text-[7px] text-white/30 tracking-widest uppercase border-b border-white/5 pb-1">
            LiDAR Telemetry Logs
          </div>
          <div className="font-mono text-[8px] text-astryx-cyan-dark space-y-1 leading-relaxed">
            {logs.map((log, index) => (
              <div key={index} className="truncate">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ INTELLIGENCE MATRIX VIEW (50 FEATURES) ═══════════════════ */

interface MatrixFeature {
  id: string
  name: string
  category: 'swarm' | 'perception' | 'security' | 'analytics' | 'automation'
  status: 'ACTIVE' | 'STANDBY' | 'DEEP_LEARNING' | 'CALIBRATING'
  desc: string
  telemetry: string[]
}

const FEATURE_DATA: MatrixFeature[] = Array.from({ length: 50 }).map((_, i) => {
  const categories: ('swarm' | 'perception' | 'security' | 'analytics' | 'automation')[] = [
    'swarm', 'perception', 'security', 'analytics', 'automation'
  ]
  const statuses: ('ACTIVE' | 'STANDBY' | 'DEEP_LEARNING' | 'CALIBRATING')[] = [
    'ACTIVE', 'STANDBY', 'DEEP_LEARNING', 'CALIBRATING'
  ]

  // Pre-configured list of names/descs to ensure high fidelity
  const names = [
    "Self-Optimizing LLM Switcher", "Contextual Memory Graph Analyzer", "Sentiment Voice Modulator", 
    "Proactive Desktop Watcher", "Real-time Threat Mitigator", "VRAM Pool Auto-Shifter", 
    "Semantic Code Indexer", "Autonomous Refactoring Agent", "Live Trend Analyzer", 
    "Interactive PowerPoint Sculptor", "Spatial Wall Projection Mapper", "Gaze-Driven Scroll Controller", 
    "Proactive Calendar Scheduler", "Adaptive Noise Cancellation Filter", "Cognitive Load Minimizer", 
    "Distributed Swarm Orchestrator", "Heuristic File Restructurer", "Semantic Git Summarizer", 
    "Context-Aware Preloading Engine", "Proactive News Composer", "Dynamic Particle EQ Balancer", 
    "DNA Sequence Genome Parser", "Quest-Based User Reward Ledger", "Celestial Star Nav Mapper", 
    "Retro CRT Render Shader", "Webcam Emotion Mirror Scan", "Medieval Time-Series Parser", 
    "Synthwave Frequency EQ Controller", "Anemometer Weather Meter", "LED Candlestick Chart Plotter", 
    "Physics Sandbox Collision Solver", "Code Crunch Minifier Engine", "Translator Passport Validator", 
    "LiDAR Boundary Sensor Sync", "Active Threat Sweep Shield", "Dreamscape Neural Generator", 
    "Waveform Spectral Audio Modulator", "VRAM Cache Purger", "Local Vector DB Connector", 
    "Unsplash Image Silent Crawler", "PPT Outline Builder", "PPT Layout Automator", 
    "PowerPoint Slideshow Previewer", "VLC Remote Playback Automator", "Local PDF Text Parser", 
    "Markdown to Presentation Compiler", "Gaze Focus Intensity Gauge", "Threat Command Restorer", 
    "Agent Launchpad Forge", "Proactive System Health Auditor"
  ]

  const descs = [
    "Swaps local models dynamically based on request complexity and length.",
    "Bridges conversational nodes to reconstruct structured knowledge structures.",
    "Adapts TTS output pitch, rate, and timbre based on user emotional states.",
    "Audits RAM, VRAM, and CPU thresholds to report memory leakage.",
    "Inspects shell command arguments for structural vulnerabilities.",
    "Saves inactive models out of GPU VRAM into host system memory dynamically.",
    "Compiles semantic embeddings of current workspaces for search routing.",
    "Refactors messy codebase files asynchronously in safe sandboxes.",
    "Monitors social networks to cache popular visual frontend design trends.",
    "Drives PowerPoint slideshow slide builders using live desktop COM automation.",
    "Simulates wall mappings and plane constraints using optical video.",
    "Auto-scrolls windows by computing gaze vectors via FaceMesh.",
    "Extracts contextual deadlines to construct calendar events automatically.",
    "Filters ambient voice noise utilizing real-time digital signal filters.",
    "Folds HUD panes automatically to minimize visual interference under load.",
    "Broadens processing tasks across neighboring local Jarvis nodes.",
    "Optimizes project directory hierarchies into cleanest structures.",
    "Constructs commit summaries by comparing local workspace diffs.",
    "Caches necessary code/libs before explicit directives are voiced.",
    "Assembles custom morning newsletters based on personalized categories.",
    "Translates voice spectral frequencies into active screen wave particles.",
    "Decodes complex DNA helixes to output bio-insights.",
    "Tracks command statistics to award game-like achievement ranks.",
    "Identifies astral configurations using location azimuth records.",
    "Renders standard inputs into beautiful retro monochrome screens.",
    "Audits real-time expressions to compute global attention rates.",
    "Converts logs into chronological historical charts.",
    "Builds retro frequency EQ curves matching specific track patterns.",
    "Monitors real-world wind and weather trends in real-time.",
    "Compiles financial metrics into LED candlestick visual tables.",
    "Computes gravitational and kinetic particle movements interactively.",
    "Compresses messy files into minified strings to optimize storage.",
    "Translates texts while issuing passport style verification marks.",
    "Coordinates LiDAR distance readings with video telemetry frames.",
    "Quarantines files and processes showing abnormal system calls.",
    "Simulates dreamscapes using fractal mathematical neural grids.",
    "Analyzes spectral details of voice clips to extract sound signatures.",
    "Flushes model storage slots after prolonged idle periods.",
    "Syncs vectors and memories with local SQLite databases.",
    "Indexes and caches matching Unsplash visual assets silently.",
    "Generates outlines and themes for presentation decks using LLM.",
    "Applies grid layouts to slides based on content keywords.",
    "Opens presentations in PowerPoint slideshow preview window.",
    "Plays voice responses and media clips using background playback tools.",
    "Performs optical character readings over local documents.",
    "Transforms raw text briefs into formatted ppt presentations.",
    "Measures user eye concentration levels to dim UI sections.",
    "Prevents destructive terminal commands from executing.",
    "Builds and tests customized agent scripts dynamically.",
    "Monitors overall hardware and reports assistant uptime parameters."
  ]

  const catIdx = i % categories.length
  const statusIdx = (i * 3 + 2) % statuses.length

  return {
    id: `feat-${i + 1}`,
    name: names[i] || `Autonomous Feature ${i + 1}`,
    category: categories[catIdx],
    status: statuses[statusIdx],
    desc: descs[i] || `Autonomous intelligence subsystem performing active tracking.`,
    telemetry: [
      `Uptime: ${(100 - i * 1.5).toFixed(1)}%`,
      `Cycle Time: ${(i * 2 + 10)}ms`
    ]
  }
})

function IntelligenceMatrixView(): React.JSX.Element {
  const [filter, setFilter] = useState<'all' | 'swarm' | 'perception' | 'security' | 'analytics' | 'automation'>('all')
  const [search, setSearch] = useState('')
  const [features, setFeatures] = useState<MatrixFeature[]>(FEATURE_DATA)

  const handleToggle = (id: string) => {
    audioEngine.playClick()
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const nextStatusMap: Record<MatrixFeature['status'], MatrixFeature['status']> = {
            ACTIVE: 'STANDBY',
            STANDBY: 'ACTIVE',
            DEEP_LEARNING: 'STANDBY',
            CALIBRATING: 'ACTIVE'
          }
          return { ...f, status: nextStatusMap[f.status] }
        }
        return f
      })
    )
  }

  const filtered = features
    .filter((f) => filter === 'all' || f.category === filter)
    .filter((f) =>
      !search.trim() ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.desc.toLowerCase().includes(search.toLowerCase())
    )

  const statusColors = {
    ACTIVE: 'border-emerald-500/30 bg-emerald-950/15 text-emerald-400',
    STANDBY: 'border-white/10 bg-white/5 text-white/40',
    DEEP_LEARNING: 'border-astryx-cyan/30 bg-astryx-cyan/15 text-astryx-cyan',
    CALIBRATING: 'border-amber-500/30 bg-amber-950/15 text-amber-400'
  }

  return (
    <div className="space-y-4 select-none">
      <div className="border-b border-white/5 pb-2">
        <h3 className="font-display text-sm tracking-wider text-white">AUTONOMOUS INTELLIGENCE MATRIX</h3>
        <p className="font-mono text-[8px] text-white/50 tracking-wider">
          Registry of 50 local assistant capabilities, sub-agents, and background processes.
        </p>
      </div>

      {/* Filter and search controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto no-scrollbar shrink-0">
          {(['all', 'swarm', 'perception', 'security', 'analytics', 'automation'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                audioEngine.playClick()
                setFilter(cat)
              }}
              className={`px-3 py-1 rounded font-mono text-[8px] tracking-wider border transition-all cursor-pointer whitespace-nowrap uppercase ${
                filter === cat
                  ? 'border-astryx-cyan/40 bg-astryx-cyan/10 text-astryx-cyan shadow-[0_0_8px_rgba(0,229,255,0.1)]'
                  : 'border-white/5 hover:border-white/20 text-white/50 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter features..."
          className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-1 text-[9px] font-mono text-white/80 focus:outline-none focus:border-astryx-cyan/40 placeholder-white/20"
        />
      </div>

      {/* Grid of features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
        {filtered.map((feat) => (
          <div
            key={feat.id}
            className="panel-luxury p-3 border border-white/5 bg-black/30 rounded flex flex-col justify-between space-y-2 hover:border-white/10 transition-all duration-300"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[9px] font-semibold text-white/90">{feat.name}</span>
                <span className={`px-1.5 py-0.5 rounded font-mono text-[6px] tracking-widest border uppercase ${statusColors[feat.status]}`}>
                  {feat.status.replace('_', ' ')}
                </span>
              </div>
              <p className="font-mono text-[8px] text-white/45 leading-relaxed">
                {feat.desc}
              </p>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-white/5">
              <div className="flex gap-3 font-mono text-[6px] text-white/30 tracking-widest uppercase">
                {feat.telemetry.map((t, idx) => (
                  <span key={idx}>{t}</span>
                ))}
              </div>
              <button
                onClick={() => handleToggle(feat.id)}
                className="px-2 py-0.5 rounded border border-white/10 hover:border-white/30 font-mono text-[7px] text-white/60 hover:text-white cursor-pointer transition-colors"
              >
                TOGGLE STATE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════ LIVE NOTES VIEW ═══════════════════ */

function LiveNotesView(): React.JSX.Element {
  const isLiveNotesActive = useJarvisStore((s) => s.isLiveNotesActive)
  const setLiveNotesActive = useJarvisStore((s) => s.setLiveNotesActive)
  const liveNotesSource = useJarvisStore((s) => s.liveNotesSource)
  const setLiveNotesSource = useJarvisStore((s) => s.setLiveNotesSource)
  const liveNotesContent = useJarvisStore((s) => s.liveNotesContent)
  const setLiveNotesContent = useJarvisStore((s) => s.setLiveNotesContent)
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-10))
  }

  const startCapture = async (type: 'mic' | 'system') => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
      addLog(`Initializing ${type} audio capture...`)
      
      let mediaStream: MediaStream
      if (type === 'system') {
        // @ts-ignore
        mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      } else {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      
      setStream(mediaStream)
      setLiveNotesSource(type)
      setLiveNotesActive(true)
      addLog(`${type.toUpperCase()} audio stream locked. Note tracker active.`)
      audioEngine.playElevate()
    } catch (e) {
      addLog(`ERROR: Failed to capture ${type} audio.`)
    }
  }

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
    setLiveNotesActive(false)
    setLiveNotesSource(null)
    addLog('Audio stream disconnected. Tracker offline.')
    audioEngine.playClick()
  }

  useEffect(() => {
    return () => stopCapture()
  }, [])

  // Audio visualization loop
  useEffect(() => {
    if (!isLiveNotesActive || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let animFrame = 0
    let phase = 0

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      const centerY = canvas.height / 2
      for (let x = 0; x < canvas.width; x++) {
        const y = Math.sin((x * 0.05) + phase) * (Math.random() * 15 + 10)
        if (x === 0) ctx.moveTo(x, centerY + y)
        else ctx.lineTo(x, centerY + y)
      }
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.stroke()
      
      phase += 0.1
      animFrame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animFrame)
  }, [isLiveNotesActive])

  // Simulated transcription loop
  useEffect(() => {
    if (!isLiveNotesActive) return
    const timer = setInterval(() => {
      const texts = [
        "Processing audio stream...",
        "Detected key topic: Artificial Intelligence",
        "Speaker 1: The architecture scales automatically.",
        "System: Noise reduced by 14db.",
        "Speaker 2: Let's focus on the live note tracker features."
      ]
      const msg = texts[Math.floor(Math.random() * texts.length)]
      addLog(msg)
      setLiveNotesContent((prev: string) => prev + `\n- ${msg}`)
    }, 3000)
    return () => clearInterval(timer)
  }, [isLiveNotesActive, setLiveNotesContent])

  const handleDownload = () => {
    audioEngine.playSuccess()
    const blob = new Blob([liveNotesContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Live_Notes_${new Date().toISOString().slice(0,10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    addLog('Notes downloaded successfully to local storage.')
  }

  return (
    <div className="panel-luxury p-5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/60 border border-emerald-500/30 select-none">
      <div className="flex flex-col space-y-4">
        <div className="border-b border-white/5 pb-2">
          <h3 className="font-display text-sm tracking-wider text-emerald-400">LIVE AUDIO TRACKER</h3>
          <p className="font-mono text-[8px] text-white/50 tracking-wider">
            Real-time audio transcription and smart note synthesis.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => isLiveNotesActive && liveNotesSource === 'mic' ? stopCapture() : startCapture('mic')}
            className={`flex-1 py-2 rounded text-center text-[9px] font-mono tracking-widest uppercase border transition-all cursor-pointer ${
              isLiveNotesActive && liveNotesSource === 'mic'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            {isLiveNotesActive && liveNotesSource === 'mic' ? 'STOP MIC' : 'TRACK MIC'}
          </button>
          <button
            onClick={() => isLiveNotesActive && liveNotesSource === 'system' ? stopCapture() : startCapture('system')}
            className={`flex-1 py-2 rounded text-center text-[9px] font-mono tracking-widest uppercase border transition-all cursor-pointer ${
              isLiveNotesActive && liveNotesSource === 'system'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            {isLiveNotesActive && liveNotesSource === 'system' ? 'STOP SYSTEM' : 'TRACK SYSTEM'}
          </button>
        </div>

        <div className="relative h-24 bg-black/50 border border-white/10 rounded overflow-hidden flex items-center justify-center">
          {isLiveNotesActive ? (
            <canvas ref={canvasRef} width={400} height={100} className="absolute inset-0 w-full h-full opacity-70" />
          ) : (
            <span className="font-mono text-[9px] text-white/30 tracking-widest uppercase">AUDIO SOURCE OFFLINE</span>
          )}
        </div>

        <div className="panel-luxury bg-black/40 border border-white/5 p-3 rounded space-y-2 h-[150px] overflow-hidden">
          <div className="font-mono text-[7px] text-emerald-400/50 tracking-widest uppercase border-b border-white/5 pb-1">
            System Telemetry Logs
          </div>
          <div className="font-mono text-[8px] text-emerald-400 space-y-1 leading-relaxed">
            {logs.map((log, index) => (
              <div key={index} className="truncate">{log}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-end border-b border-white/5 pb-2">
          <h3 className="font-display text-sm tracking-wider text-white">CAPTURED NOTES</h3>
          <button 
            onClick={handleDownload}
            disabled={!liveNotesContent}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded font-mono text-[9px] text-white tracking-widest transition-all cursor-pointer"
          >
            DOWNLOAD (MD)
          </button>
        </div>
        
        <textarea
          value={liveNotesContent}
          onChange={(e) => setLiveNotesContent(e.target.value)}
          className="flex-1 min-h-[250px] bg-black/40 border border-white/10 rounded p-4 font-mono text-[10px] text-white/80 leading-relaxed outline-none focus:border-emerald-500/50 transition-all custom-scrollbar resize-none"
          placeholder="Notes will auto-generate here once tracking is active..."
        />
      </div>
    </div>
  )
}

