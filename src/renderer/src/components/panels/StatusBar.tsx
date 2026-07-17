import { useJarvisStore } from '@/stores/jarvis.store'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { audioEngine } from '@/utils/AudioEngine'


export function StatusBar(): React.JSX.Element {
  const currentModel = useJarvisStore((s) => s.currentModel)
  const isAgentActive = useJarvisStore((s) => s.isAgentActive)
  const isAdmin = useJarvisStore((s) => s.isAdmin)
  const hudMode = useJarvisStore((s) => s.hudMode)
  const toggleHudMode = useJarvisStore((s) => s.toggleHudMode)
  const activeTheme = useJarvisStore((s) => s.activeTheme)
  const setActiveTheme = useJarvisStore((s) => s.setActiveTheme)
  const [time, setTime] = useState(new Date())

  const themes: ('cyan' | 'purple' | 'green' | 'amber' | 'red')[] = ['cyan', 'purple', 'green', 'amber', 'red']
  const handleCycleTheme = (): void => {
    const currentIndex = themes.indexOf(activeTheme)
    const nextIndex = (currentIndex + 1) % themes.length
    setActiveTheme(themes[nextIndex])
    audioEngine.playClick()
  }


  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full flex flex-wrap justify-between items-start pointer-events-none" style={{ paddingTop: 'clamp(0.75rem, 2vw, 1.5rem)', gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
      <div className="flex flex-wrap gap-2 lg:gap-4">
        {/* Top-left HUD block */}
        <motion.div
          className="glass-premium px-6 py-3 flex items-center gap-5 pointer-events-auto"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Animated core indicator */}
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border border-white/30 animate-pulse-cyan" />
            <div className="absolute inset-1 rounded-full border border-white/10" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/20 to-transparent flex items-center justify-center shadow-[inset_0_0_10px_rgba(255,255,255,0.2)]">
              <motion.div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(0,229,255,0.4)',
                }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              />
            </div>
          </div>

          <div>
            <motion.div
              className="font-display text-2xl tracking-[0.3em] text-white"
              style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}
              animate={{ opacity: [0.9, 1, 0.9] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              ASTRYX
            </motion.div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-white/60 uppercase">
              {currentModel || 'System Awaiting Load'}
            </div>
          </div>
        </motion.div>          {/* Live Clock */}
        <motion.div
          className="glass-premium px-2 lg:px-4 py-2 lg:py-3 flex items-center gap-2 lg:gap-3 pointer-events-auto"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(0,229,255,0.6)]" />
          <div className="font-mono text-[10px] text-white/80 tracking-[0.15em]">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </motion.div>

        {/* HUD Controls */}
        <motion.div
          className="glass-premium px-2 lg:px-4 py-2 lg:py-3 flex items-center gap-3 pointer-events-auto"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Theme switcher */}
          <button
            onClick={handleCycleTheme}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/10 hover:border-white/30 text-[8px] font-mono tracking-widest text-white/70 hover:text-white uppercase transition-all cursor-pointer"
            title="Cycle Interface Theme Style"
          >
            🎨 {activeTheme}
          </button>

          <div className="w-px h-3 bg-white/10" />

          {/* HUD Mode Toggle */}
          <button
            onClick={() => {
              toggleHudMode()
              audioEngine.playClick()
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/10 hover:border-white/30 text-[8px] font-mono tracking-widest text-white/70 hover:text-white uppercase transition-all cursor-pointer"
            title={hudMode === 'full' ? 'Collapse HUD Panels (Stealth)' : 'Expand HUD Panels'}
          >
            🖥️ {hudMode === 'full' ? 'FULL' : 'MIN'}
          </button>
        </motion.div>
      </div>

      <div className="flex flex-wrap gap-2 lg:gap-4">
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass-premium px-2 lg:px-4 py-2 lg:py-3 flex items-center gap-2 lg:gap-3 pointer-events-auto cursor-help"
            style={{
              borderColor: 'rgba(16, 185, 129, 0.5)',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
            }}
            title="ASTRYX Core elevated to system administrator authority."
          >
            <motion.span
              className="text-emerald-400 text-xs"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              🛡️
            </motion.span>
            <span className="font-mono text-[9px] tracking-[0.25em] font-semibold text-emerald-400 uppercase">
              ELEVATED ADMIN
            </span>
          </motion.div>
        )}

        <motion.div
          className="glass-premium px-3 lg:px-6 py-2 lg:py-3 flex items-center gap-2 lg:gap-4 pointer-events-auto"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col text-right">
            <div className="font-mono text-[10px] text-white/80 uppercase tracking-[0.2em]">
              Autonomous Agent
            </div>
            <div className="font-mono text-[9px] tracking-widest text-white/50">
              {isAgentActive ? 'ENGAGED' : 'STANDBY'}
            </div>
          </div>
          <div className="relative">
            {isAgentActive ? (
              <div className="status-dot status-dot-ready">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: '#00e5ff' }}
                  animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full border border-white/30" style={{ backgroundColor: '#ffffff22' }} />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
