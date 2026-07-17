import { useJarvisStore } from '@/stores/jarvis.store'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export function StatusBar(): React.JSX.Element {
  const currentModel = useJarvisStore((s) => s.currentModel)
  const isAgentActive = useJarvisStore((s) => s.isAgentActive)
  const isAdmin = useJarvisStore((s) => s.isAdmin)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full flex justify-between items-start pt-6 px-10 pointer-events-none">
      <div className="flex gap-4">
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
        </motion.div>

        {/* Live Clock */}
        <motion.div
          className="glass-premium px-4 py-3 flex items-center gap-3 pointer-events-auto"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(0,229,255,0.6)]" />
          <div className="font-mono text-[10px] text-white/80 tracking-[0.15em]">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </motion.div>
      </div>

      <div className="flex gap-4">
        {/* Admin status badge */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass-premium px-4 py-3 flex items-center gap-3 pointer-events-auto cursor-help"
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

        {/* Top-right HUD block */}
        <motion.div
          className="glass-premium px-6 py-3 flex items-center gap-4 pointer-events-auto"
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
