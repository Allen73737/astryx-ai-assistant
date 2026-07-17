import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore, type ConnectionStatus } from '@/stores/jarvis.store'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useVoiceCapture } from '@/hooks/useVoiceCapture'
import { StatusBar } from '@/components/panels/StatusBar'
import { LeftPanel } from '@/components/panels/LeftPanel'
import { RightPanel } from '@/components/panels/RightPanel'
import { BottomBar } from '@/components/panels/BottomBar'
import { AIOrb } from '@/components/core/AIOrb'
import { HUDOverlay } from '@/components/core/HUDOverlay'
import { FaceHUD } from '@/components/core/FaceHUD'
import { Background } from '@/components/core/Background'
import { BootSequence } from '@/components/core/BootSequence'
import { useFaceTracking } from '@/hooks/useFaceTracking'
import { useAmbientLight } from '@/hooks/useAmbientLight'
import { useVoiceShortcuts } from '@/hooks/useVoiceShortcuts'

function App(): React.JSX.Element {
  const connectionStatus = useJarvisStore((s) => s.connectionStatus)
  const setBackendConfig = useJarvisStore((s) => s.setBackendConfig)
  const isRightExpanded = useJarvisStore((s) => s.isRightExpanded)
  const pendingPermissionRequest = useJarvisStore((s) => s.pendingPermissionRequest)
  const stealthMode = useJarvisStore((s) => s.stealthMode)
  const [initialized, setInitialized] = useState(false)
  const [booting, setBooting] = useState(true)
  
  const hudMode = useJarvisStore((s) => s.hudMode)
  const activeTheme = useJarvisStore((s) => s.activeTheme)
  const leftOpen = hudMode === 'full'
  const rightOpen = hudMode === 'full'


  const orbState = useJarvisStore((s) => s.orbState)
  const [isVisible, setIsVisible] = useState(true)
  const loadVoicesFromStorage = useJarvisStore((s) => s.loadVoicesFromStorage)

  /* Initialize backend config from Electron IPC */
  useEffect(() => {
    async function init(): Promise<void> {
      try {
        if (window.jarvis) {
          const config = await window.jarvis.getBackendConfig()
          setBackendConfig(config.httpUrl, config.wsUrl)
        }
      } catch (err) {
        console.warn('Running outside Electron, using defaults', err)
      }
      setInitialized(true)
    }
    init()
  }, [setBackendConfig])

  /* Listen to Global Voice Shortcut */
  useEffect(() => {
    if (window.jarvis && window.jarvis.onVoiceToggle) {
      return window.jarvis.onVoiceToggle(() => {
        useJarvisStore.getState().sendWsMessage('manual_voice_toggle', {})
      })
    }
  }, [])

  /* Load persisted voice profiles from localStorage */
  useEffect(() => {
    loadVoicesFromStorage()
  }, [loadVoicesFromStorage])

  /* Connect WebSocket after initialization */
  useWebSocket()

  /* Start browser-side voice capture (mic via Web Audio API) */
  useVoiceCapture()
  
  /* Start face tracking hook */
  useFaceTracking()

  /* Keyboard shortcuts for quick voice switching */
  useVoiceShortcuts()

  /* Ambient light adaptation based on system time */
  const glowIntensity = useAmbientLight()

  useEffect(() => {
    // Ghost UI Reveal Trigger
    if (orbState === 'listening' || orbState === 'speaking' || orbState === 'processing') {
      setIsVisible(true)
    }
  }, [orbState])

  if (booting) {
    return <BootSequence onComplete={() => setBooting(false)} />
  }

  if (!initialized) {
    return <LoadingScreen />
  }

  // If invisible, render nothing so it doesn't block clicks (actually just opacity 0)
  if (!isVisible) {
    return <div className="w-full h-full bg-transparent" />
  }

  return (
        <div 
      className={`relative w-[100vw] h-[100vh] overflow-hidden transition-all duration-1000 bg-astryx-obsidian theme-${activeTheme}`} 
      id="astryx-root"
    >
      <Background />

      {/* Titlebar drag region */}
      <div className="titlebar-drag absolute top-0 left-0 right-0 z-50" style={{ height: 'clamp(1.5rem, 3vw, 2.25rem)' }} />

      {/* Minimize and Close Buttons manually injected into HUD */}
      <div className="absolute flex gap-2 lg:gap-3 z-[100]" style={{ top: 'clamp(0.75rem, 2vw, 1.5rem)', right: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
        <button 
          onClick={() => {
            if (window.jarvis) window.jarvis.minimize()
          }}
          className="rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-astryx-text transition-colors backdrop-blur-xl border border-white/20"
          style={{ width: 'clamp(1.75rem, 3vw, 2.5rem)', height: 'clamp(1.75rem, 3vw, 2.5rem)' }}
          title="Minimize"
        >
          ─
        </button>
        <button 
          onClick={() => {
            setIsVisible(false)
            if (window.jarvis) window.jarvis.close()
          }}
          className="rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-astryx-text transition-colors backdrop-blur-xl border border-white/20"
          style={{ width: 'clamp(1.75rem, 3vw, 2.5rem)', height: 'clamp(1.75rem, 3vw, 2.5rem)' }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* HUD overlay (corner brackets, scan lines) */}
      <HUDOverlay />
      
      {/* Dynamic AR Face HUD overlay */}
      <FaceHUD />

      {/* Main content grid */}
      <div className="relative z-10 w-full h-full flex flex-col" style={{ padding: 'var(--status-padding)' }}>
        {/* Status bar */}
        <StatusBar />

        {/* Center area: Left panel + Orb + Right panel */}
        <div className={`flex-1 flex items-stretch min-h-0 relative transition-all duration-500 ${isRightExpanded ? 'px-0 gap-0' : ''}`} style={{ marginTop: 'clamp(0.5rem, 1.5vw, 1rem)', gap: isRightExpanded ? '0' : 'var(--panel-gap)', paddingLeft: isRightExpanded ? '0' : '0', paddingRight: isRightExpanded ? '0' : '0' }}>
          
          {/* Left panel */}
          <motion.div 
            initial={{ width: 0, opacity: 0, scale: 0.95 }}
            animate={{ 
              width: leftOpen && !isRightExpanded ? 'var(--panel-width)' : 0, 
              opacity: leftOpen && !isRightExpanded ? 1 : 0,
              scale: leftOpen && !isRightExpanded ? 1 : 0.95,
            }}
            transition={{ type: "spring", stiffness: 250, damping: 35, mass: 1 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="w-full h-full opacity-40 hover:opacity-100 transition-opacity duration-500">
              <LeftPanel />
            </div>
          </motion.div>

          {/* Center orb */}
          <div className={`flex-1 flex items-center justify-center relative z-10 transition-all duration-500 ${isRightExpanded ? 'hidden' : ''}`}>
            <AIOrb />
          </div>

          {/* Right panel */}
          <motion.div 
            initial={{ width: 0, opacity: 0, scale: 0.95 }}
            animate={{ 
              width: rightOpen ? (isRightExpanded ? 'var(--panel-width-expanded)' : 'var(--panel-width)') : 0, 
              opacity: rightOpen ? 1 : 0,
              scale: rightOpen ? 1 : 0.95,
            }}
            transition={{ type: "spring", stiffness: 250, damping: 35, mass: 1, delay: 0.05 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="w-full h-full opacity-40 hover:opacity-100 transition-opacity duration-500">
              <RightPanel />
            </div>
          </motion.div>
        </div>

        {/* Bottom command bar */}
        <div style={{ marginTop: 'clamp(0.75rem, 2vw, 2rem)' }}>
          <BottomBar />
        </div>
      </div>

      {/* Stealth Mode Indicator Overlay */}
      {stealthMode && (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-[9999] bg-[#001224]/80 border border-[#00e5ff]/30 px-3 py-1 rounded-full font-mono text-[7px] text-[#00e5ff] tracking-[0.25em] flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,229,255,0.15)] pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping" />
          <span>STEALTH RECORD SHIELD ENGAGED (EXCLUDED FROM EXTERNAL CAPTURE)</span>
        </div>
      )}

      {/* Webcam permission gateway modal */}
      {pendingPermissionRequest && (
        <WebcamPermissionDialog
          sessionId={pendingPermissionRequest.sessionId}
          onResolve={(allowed) => {
            useJarvisStore.getState().sendWsMessage('webcam_permission_response', {
              session_id: pendingPermissionRequest.sessionId,
              allowed
            })
            useJarvisStore.getState().setPendingPermissionRequest(null)
          }}
        />
      )}
    </div>
  )
}

/* ═══════════════════ WEBCAM GATEWAY DIALOG ═══════════════════ */

function WebcamPermissionDialog({ sessionId, onResolve }: { sessionId: string, onResolve: (allowed: boolean) => void }): React.JSX.Element {
  const [countdown, setCountdown] = useState(30)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onResolve(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onResolve])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[99999] pointer-events-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="panel-luxury p-8 w-[380px] text-center space-y-6 bg-gradient-to-b from-[#001224] to-[#00050d] border border-[#00e5ff]/50 shadow-[0_0_50px_rgba(0,229,255,0.25)]"
      >
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full border border-[#00e5ff] flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <span className="text-[#00e5ff] text-xl">🔒</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="font-display text-md tracking-[0.2em] text-white">WEBCAM AUTHORIZATION GATE</h3>
          <p className="font-mono text-[9px] text-[#00a8cc] tracking-widest leading-relaxed">
            ASTRYX REQUESTS TEMPORARY ACCESS TO CAMERA SURVEILLANCE FEED FOR FACIAL EMOTION SCANNING.
          </p>
        </div>

        {/* Countdown timer progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[8px] text-white/50 tracking-wider">
            <span>GATE DISMISS IN</span>
            <span>{countdown}s</span>
          </div>
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00e5ff] transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <button
            onClick={() => onResolve(false)}
            className="flex-1 py-2 rounded border border-red-500/30 hover:border-red-500 bg-red-950/10 hover:bg-red-950/30 text-red-400 font-mono text-[10px] tracking-widest uppercase transition-all cursor-pointer"
          >
            DENY ACCESS
          </button>
          <button
            onClick={() => onResolve(true)}
            className="flex-1 py-2 rounded border border-emerald-500/30 hover:border-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/30 text-emerald-400 font-mono text-[10px] tracking-widest uppercase transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)]"
          >
            APPROVE
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* ═══════════════════ LOADING SCREEN ═══════════════════ */

function LoadingScreen(): React.JSX.Element {
  return (
    <div className="w-full h-full flex items-center justify-center bg-astryx-bg">
      <div className="text-center">
        <div className="w-16 h-16 border-t-2 border-astryx-cyan rounded-full animate-spin mx-auto mb-4" />
        <div className="font-mono text-xs text-astryx-cyan tracking-widest uppercase">
          Initializing ASTRYX...
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ CONNECTION OVERLAY ═══════════════════ */

function ConnectionOverlay({ status }: { status: ConnectionStatus }): React.JSX.Element {
  const labels: Record<ConnectionStatus, string> = {
    disconnected: 'Backend Disconnected',
    connecting: 'Connecting to Backend...',
    connected: 'Connected',
    error: 'Connection Error'
  }

  const colors: Record<ConnectionStatus, string> = {
    disconnected: 'text-astryx-amber',
    connecting: 'text-astryx-cyan',
    connected: 'text-astryx-emerald',
    error: 'text-astryx-red'
  }

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50">
      <div className="panel-hud px-6 py-3 flex items-center gap-3">
        <div className={`status-dot ${
          status === 'connecting' ? 'status-dot-swapping' :
          status === 'error' ? 'status-dot-error' :
          'status-dot-swapping'
        }`} />
        <span className={`font-mono text-xs tracking-wider uppercase ${colors[status]}`}>
          {labels[status]}
        </span>
      </div>
    </div>
  )
}

export default App
