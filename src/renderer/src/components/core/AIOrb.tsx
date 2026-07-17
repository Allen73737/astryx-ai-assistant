import { useJarvisStore, type OrbState } from '@/stores/jarvis.store'
import { motion, useAnimationFrame } from 'framer-motion'
import { useEffect, useRef, useState, useCallback } from 'react'
import { audioEngine } from '@/utils/AudioEngine'

const STATE_COLORS: Record<OrbState, string> = {
  standby: '#00e5ff',
  listening: '#00e5ff',
  processing: '#0088cc',
  speaking: '#00e5ff',
  executing: '#10b981',
  error: '#ef4444',
  model_swap: '#f97316',
  ar_mode: '#a855f7'
}

/* ── Canvas-based particle system (GPU-friendly, no React re-renders) ── */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  radius: number
  hue: number
}

function useCanvasParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>, colorStr: string, orbSize: number = 400) {
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef(0)

  const burst = useCallback(() => {
    const center = orbSize / 2
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.4
      const speed = (1.5 + Math.random() * 3.5) * (orbSize / 400)
      particlesRef.current.push({
        x: center,
        y: center,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 40,
        radius: (1.5 + Math.random() * 2.5) * (orbSize / 400),
        hue: 185 + Math.random() * 40,
      })
    }
  }, [orbSize])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* Parse hex color to HSL-like hue for glow mixing */
    /* Parse hex color to RGB for glow mixing */
    const hex = colorStr.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16) || 0
    const g = parseInt(hex.substring(2, 4), 16) || 0
    const b = parseInt(hex.substring(4, 6), 16) || 229

    const draw = () => {
      /* Sync canvas resolution to display size */
      const displayWidth = canvas!.offsetWidth
      const displayHeight = canvas!.offsetHeight
      if (canvas!.width !== displayWidth || canvas!.height !== displayHeight) {
        canvas!.width = displayWidth
        canvas!.height = displayHeight
      }

      const ctx = canvas!.getContext('2d')
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }

      /* Full clear each frame — particles fade via life/progress */
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)

      const particles = particlesRef.current

      /* Update & draw */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.97
        p.vy *= 0.97
        p.life++

        if (p.life >= p.maxLife) {
          particles.splice(i, 1)
          continue
        }

        const progress = p.life / p.maxLife
        const opacity = 1 - progress
        const radius = p.radius * (1 - progress * 0.5)

        /* Glow gradient */
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4)
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.9})`)
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${opacity * 0.3})`)
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

        ctx.beginPath()
        ctx.arc(p.x, p.y, radius * 4, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        /* Core dot */
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`
        ctx.fill()
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [canvasRef, colorStr, orbSize])

  return { burst }
}

export function AIOrb() {
  const orbState = useJarvisStore((s) => s.orbState)
  const colorStr = STATE_COLORS[orbState] || STATE_COLORS.standby
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const [orbSize, setOrbSize] = useState(400)
  const { burst } = useCanvasParticles(canvasRef, colorStr, orbSize)
  const prevState = useRef(orbState)
  const [shockwave, setShockwave] = useState(0)

  // Track orb container size for responsive canvas
  useEffect(() => {
    const el = orbRef.current
    if (!el) return
    const updateSize = () => {
      const size = el.offsetWidth || 400
      setOrbSize(size)
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Trigger effects on state change
  useEffect(() => {
    if (orbState !== prevState.current) {
      burst()
      setShockwave(1)
      setTimeout(() => setShockwave(0), 1000)
      audioEngine.playOrbState(orbState)
      prevState.current = orbState
    }
  }, [orbState, burst])

  const coreScale = orbState === 'processing' ? [0.9, 1.3, 0.9] : 1
  const blurAmount = orbState === 'listening' ? 'blur(20px)' : 'blur(40px)'

  return (
    <div className="w-full h-full flex items-center justify-center relative pointer-events-none">
      <motion.div
        ref={orbRef}
        className="relative flex items-center justify-center"
        style={{ width: 'var(--orb-size-max)', height: 'var(--orb-size-max)', maxWidth: '520px', maxHeight: '520px' }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Shockwave ring */}
        {shockwave > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: colorStr, borderWidth: '2px' }}
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}

        {/* Aurora plasma field */}
        <motion.div
          className="absolute inset-[-40px] rounded-full opacity-20"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${colorStr}88, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{
            background: [
              `radial-gradient(circle at 30% 40%, ${colorStr}66, transparent 70%)`,
              `radial-gradient(circle at 70% 60%, ${colorStr}88, transparent 70%)`,
              `radial-gradient(circle at 50% 30%, ${colorStr}66, transparent 70%)`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        />

        {/* 3D Glass Sphere */}
        <div className="absolute inset-8 glass-sphere-luminous z-20" />

        {/* Canvas-based particle overlay (GPU-accelerated, no React overhead) */}
        <canvas
          ref={canvasRef}
          width={orbSize}
          height={orbSize}
          className="absolute inset-0 z-30 pointer-events-none w-full h-full"
        />

        {/* Inner ring - rotating */}
        <motion.div
          className="absolute z-10 rounded-full border"
          style={{
            width: '160px',
            height: '160px',
            borderColor: `${colorStr}66`,
            boxShadow: `0 0 15px ${colorStr}22, inset 0 0 15px ${colorStr}22`,
          }}
          animate={{ scale: coreScale, rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
        />

        {/* Inner solid ring */}
        <motion.div
          className="absolute z-10 rounded-full"
          style={{
            width: '120px',
            height: '120px',
            border: `1px solid ${colorStr}33`,
            boxShadow: `inset 0 0 20px ${colorStr}11`,
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        />

        {/* Wireframe SVG ring 1 */}
        <motion.svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full opacity-30 z-0"
          style={{ color: colorStr }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
        >
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1 5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.15" strokeDasharray="10 4" opacity="0.5" />
        </motion.svg>

        {/* Wireframe SVG ring 2 (counter-rotating) */}
        <motion.svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full opacity-40 z-30"
          style={{ color: colorStr }}
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
        >
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="20 10 2 10" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="0.1" strokeDasharray="3 7" opacity="0.4" />
        </motion.svg>

        {/* 3D rotating cube wireframe */}
        <motion.svg
          viewBox="0 0 100 100"
          className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] opacity-15 z-5"
          style={{ color: colorStr }}
          animate={{ rotateX: 360, rotateY: 180 }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
        >
          <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="0.2" />
          <line x1="20" y1="20" x2="35" y2="35" stroke="currentColor" strokeWidth="0.2" />
          <line x1="80" y1="20" x2="65" y2="35" stroke="currentColor" strokeWidth="0.2" />
          <line x1="80" y1="80" x2="65" y2="65" stroke="currentColor" strokeWidth="0.2" />
          <line x1="20" y1="80" x2="35" y2="65" stroke="currentColor" strokeWidth="0.2" />
          <rect x="35" y="35" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="0.15" opacity="0.5" />
        </motion.svg>

        {/* Text Layer */}
        <div className="absolute flex flex-col items-center justify-center z-40">
          <motion.div
            className="font-display tracking-[0.4em] font-bold"
            style={{
              color: '#ffffff',
              fontSize: 'clamp(1.75rem, 4vw, 4.5rem)',
              textShadow: `0 0 8px ${colorStr}cc, 0 0 25px ${colorStr}66`,
            }}
            animate={{
              textShadow: orbState === 'listening'
                ? [
                    `0 0 10px ${colorStr}`,
                    `0 0 25px ${colorStr}`,
                    `0 0 10px ${colorStr}`,
                  ]
                : `0 0 12px ${colorStr}99`,
            }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            ASTRYX
          </motion.div>
          <motion.div
            className="font-mono text-[10px] tracking-[0.6em] mt-4 uppercase font-bold"
            style={{
              color: colorStr,
              textShadow: `0 0 5px ${colorStr}88`,
            }}
            animate={
              orbState === 'error'
                ? { opacity: [1, 0.3, 1], x: [0, -2, 2, 0] }
                : { opacity: 1 }
            }
            transition={orbState === 'error' ? { repeat: Infinity, duration: 0.5 } : {}}
          >
            {orbState} // CORE
          </motion.div>
        </div>
      </motion.div>

      {/* HUD Decorations */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <motion.div
          className="absolute top-12 left-12 font-mono text-[9px] tracking-[0.3em]"
          style={{ color: `${colorStr}aa` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        >
          SYS.LOC // 45.912, -12.441
        </motion.div>
        <motion.div
          className="absolute bottom-12 right-12 font-mono text-[9px] tracking-[0.3em]"
          style={{ color: `${colorStr}aa` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
        >
          NET.UPLINK // SECURE
        </motion.div>
        <motion.div
          className="absolute top-12 right-12 font-mono text-[9px] tracking-[0.3em]"
          style={{ color: `${colorStr}aa` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 2 }}
        >
          ORB.STATE // {orbState.toUpperCase()}
        </motion.div>
      </div>
    </div>
  )
}
