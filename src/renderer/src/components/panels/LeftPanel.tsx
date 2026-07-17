import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'

type LeftTab = 'tasks' | 'agents' | 'logs' | 'metrics'

export function LeftPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<LeftTab>('metrics')

  const tabs: { id: LeftTab; label: string }[] = [
    { id: 'metrics', label: 'METRICS' },
    { id: 'tasks', label: 'TASKS' },
    { id: 'agents', label: 'AGENTS' },
    { id: 'logs', label: 'LOGS' }
  ]

  return (
    <div className="panel-luxury h-full flex flex-col pointer-events-auto shadow-[0_20px_40px_rgba(0,0,0,0.4)]" id="left-panel">
      {/* Tab bar */}
      <div className="flex border-b border-white/20 px-2 bg-transparent/40">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : ''}`}
            onClick={() => {
              audioEngine.playClick()
              setActiveTab(tab.id)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-y-auto p-4"
          >
            {activeTab === 'metrics' && <MetricsTab />}
            {activeTab === 'tasks' && <TasksTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'logs' && <LogsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ═══════════════════ TASKS TAB ═══════════════════ */

function TasksTab(): React.JSX.Element {
  const tasks = useJarvisStore((s) => s.tasks)

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/60/60">
        <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center mb-3 shadow-[inset_0_0_10px_rgba(207,161,68,0.1)]">
          <span className="font-mono text-white text-xs">IDLE</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">No Active Directives</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task, i) => (
        <motion.div
          key={task.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="p-3 border border-white/20 bg-white/30 relative rounded-lg overflow-hidden"
        >
          {/* Subtle luxury glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between mb-2 relative z-10">
            <span className="font-mono text-[10px] text-white/90 uppercase tracking-widest truncate max-w-[160px]">
              {task.label}
            </span>
            <span
              className={`status-dot ${
                task.status === 'running'
                  ? 'status-dot-swapping'
                  : task.status === 'completed'
                    ? 'status-dot-ready'
                    : 'status-dot-error'
              }`}
            />
          </div>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <span className="font-mono text-[8px] text-white uppercase tracking-[0.2em] px-1.5 py-0.5 rounded bg-white/10">
              {task.model}
            </span>
            <span className="font-mono text-[8px] text-white/60 tracking-widest">
              T+{formatElapsed(task.startedAt)}
            </span>
          </div>
          {/* Luxury Progress bar */}
          <div className="h-[2px] bg-white/20 w-full relative rounded-full overflow-hidden z-10">
            <motion.div
              className="absolute top-0 left-0 bottom-0 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              animate={{ width: `${task.progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ═══════════════════ AGENTS TAB ═══════════════════ */

function AgentsTab(): React.JSX.Element {
  const models = useJarvisStore((s) => s.models)
  const currentModel = useJarvisStore((s) => s.currentModel)

  return (
    <div className="space-y-2">
      {models.map((model, i) => {
        const isActive = model.id === currentModel
        return (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => {
              if (!isActive && model.status !== 'loading') {
                useJarvisStore.getState().sendWsMessage('model_swap', { model: model.id })
                useJarvisStore.getState().setOrbState('model_swap')
              }
            }}
            className={`p-3 border transition-all duration-300 rounded-lg relative overflow-hidden ${
              isActive
                ? 'bg-white/5 border-white/40 shadow-[0_0_20px_rgba(207,161,68,0.1)]'
                : 'bg-white/20 border-white/10 opacity-60 hover:opacity-100 hover:border-white/30 cursor-pointer'
            }`}
          >
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-white/80 to-white/20" />}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2 ml-2">
                <span
                  className={`status-dot ${
                    model.status === 'loaded'
                      ? 'status-dot-ready'
                      : model.status === 'loading'
                        ? 'status-dot-swapping'
                        : 'status-dot-error'
                  }`}
                />
                <span className={`font-mono text-[10px] uppercase tracking-wider ${isActive ? 'text-white drop-shadow-sm' : 'text-white/90'}`}>
                  {model.name}
                </span>
              </div>
              <span className="font-mono text-[8px] text-white/60 uppercase tracking-[0.2em]">
                {model.status}
              </span>
            </div>
            {model.vramUsage !== undefined && (
              <div className="mt-2 ml-4 font-mono text-[9px] text-white/60 tracking-widest relative z-10">
                VRAM ALLOC // {model.vramUsage}MB
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

/* ═══════════════════ LOGS TAB ═══════════════════ */

function LogsTab(): React.JSX.Element {
  const messages = useJarvisStore((s) => s.messages)

  return (
    <div className="space-y-1.5 font-mono text-[9px]">
      {messages.length === 0 ? (
        <div className="text-white/60/50 text-center py-8 uppercase tracking-widest">
          SYS.LOG_EMPTY
        </div>
      ) : (
        messages.slice(-50).map((msg) => (
          <div key={msg.id} className="flex gap-2 py-1 border-b border-white/5">
            <span className="text-white/60/50 shrink-0">
              {new Date(msg.timestamp).toLocaleTimeString('en-GB')}
            </span>
            <span
              className={
                msg.role === 'user'
                  ? 'text-astryx-platinum'
                  : msg.role === 'system'
                    ? 'text-red-400'
                    : 'text-white'
              }
            >
              [{msg.role.substring(0, 3).toUpperCase()}]
            </span>
            <span className="text-white/90/80 truncate font-light tracking-wide">{msg.content}</span>
          </div>
        ))
      )}
    </div>
  )
}

/* ═══════════════════ METRICS TAB (CIRCULAR GAUGES) ═══════════════════ */

function CircularGauge({ label, value, color }: { label: string, value: number, color: string }) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center w-16 h-16">
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={`${color}33`} // 20% opacity
            strokeWidth="3"
            fill="transparent"
          />
          {/* Animated value ring */}
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            stroke={color}
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="drop-shadow-[0_0_4px_currentColor]"
          />
          {/* Decorative tick marks */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1="32"
              y1="4"
              x2="32"
              y2="8"
              stroke={color}
              strokeWidth="1"
              strokeOpacity={0.5}
              transform={`rotate(${i * 30} 32 32)`}
            />
          ))}
        </svg>
        <span className="font-mono text-[10px] text-white/90 relative z-10" style={{ color }}>
          {Math.round(value)}%
        </span>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

function LinearGauge({ label, value, max = 100, unit = '%', color = 'rgba(0, 229, 255, 0.8)' }: { label: string, value: number, max?: number, unit?: string, color?: string }) {
  const percent = Math.min((value / max) * 100, 100)
  return (
    <div className="flex flex-col gap-1 font-mono text-[9px]">
      <div className="flex justify-between text-white/55">
        <span>{label}</span>
        <span style={{ color }}>{value.toFixed(0)}{unit}</span>
      </div>
      <div className="h-2 w-full bg-white/5 border border-white/10 rounded overflow-hidden relative p-[1px]">
        <motion.div
          className="h-full rounded-[2px]"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function MetricsTab(): React.JSX.Element {
  const metrics = useJarvisStore((s) => s.metrics)

  return (
    <div className="h-full flex flex-col justify-between py-2 gap-4">
      <div className="grid grid-cols-2 gap-y-4 gap-x-2">
        <CircularGauge label="CPU CORE" value={metrics.cpuUsage} color="#00e5ff" />
        <CircularGauge label="GPU COMPUTE" value={metrics.gpuUsage} color="#00e5ff" />
        <CircularGauge label="SYS MEMORY" value={metrics.ramUsage} color="#00d4ff" />
        <CircularGauge label="VRAM ALLOC" value={metrics.vramUsage} color="#00d4ff" />
      </div>

      <div className="space-y-3 mt-2 px-1">
        <LinearGauge label="DISK STORAGE" value={metrics.diskUsage} max={100} unit="%" color="#00d4ff" />
        <LinearGauge label="NETWORK UPLOAD" value={metrics.networkUp} max={5000} unit=" KB/s" color="#b3f5ff" />
        <LinearGauge label="NETWORK DOWNLOAD" value={metrics.networkDown} max={5000} unit=" KB/s" color="#b3f5ff" />
      </div>
      
      {/* Decorative center piece */}
      <div className="flex justify-center mt-2">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 bg-[#00050d] font-mono text-[7px] text-white/50 tracking-[0.3em] rounded-full border border-white/10">
            SYS.DIAGNOSTICS
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ HELPERS ═══════════════════ */

function formatElapsed(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  if (elapsed < 60) return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
}
