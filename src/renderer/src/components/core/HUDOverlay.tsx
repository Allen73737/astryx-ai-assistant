import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function HUDOverlay(): React.JSX.Element {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-1000"
      style={{ opacity: visible ? 1 : 0 }}
      id="hud-overlay"
    >
      {/* Corner Brackets */}
      <CornerBracket position="top-left" />
      <CornerBracket position="top-right" />
      <CornerBracket position="bottom-left" />
      <CornerBracket position="bottom-right" />

      {/* Top center crosshair */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-4 h-[1px] bg-cyan-500/40" />
        <div className="w-[1px] h-4 bg-cyan-500/40" />
      </div>

      {/* Bottom center crosshair */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-4 h-[1px] bg-cyan-500/40" />
        <div className="w-[1px] h-4 bg-cyan-500/40" />
      </div>

      {/* Left center crosshair */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center">
        <div className="w-4 h-[1px] bg-cyan-500/40" />
        <div className="w-[1px] h-4 bg-cyan-500/40" />
      </div>

      {/* Right center crosshair */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
        <div className="w-4 h-[1px] bg-cyan-500/40" />
        <div className="w-[1px] h-4 bg-cyan-500/40" />
      </div>

      {/* Radar sweep in top-left */}
      <div className="absolute" style={{ top: 'clamp(3rem, 6vw, 4rem)', left: 'clamp(0.75rem, 2vw, 1.5rem)', width: 'var(--hud-radar-size)', height: 'var(--hud-radar-size)' }}>
        <svg viewBox="0 0 64 64" className="w-full h-full opacity-30">
          <circle cx="32" cy="32" r="30" fill="none" stroke="#00e5ff" strokeWidth="0.5" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="#00e5ff" strokeWidth="0.3" opacity="0.5" />
          <circle cx="32" cy="32" r="10" fill="none" stroke="#00e5ff" strokeWidth="0.2" opacity="0.3" />
          <motion.line
            x1="32" y1="32"
            x2="62" y2="32"
            stroke="#00e5ff"
            strokeWidth="1"
            strokeLinecap="round"
            animate={{ rotate: 360 }}
            style={{ transformOrigin: '32px 32px' }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
          />
          <motion.path
            d="M32,32 L62,32 A30,30 0 0,1 57.7,47.7 Z"
            fill="#00e5ff"
            opacity="0.15"
            animate={{ rotate: 360 }}
            style={{ transformOrigin: '32px 32px' }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
          />
        </svg>
      </div>

      {/* Top-left HUD text */}
      <div className="absolute font-mono leading-relaxed tracking-wider" style={{ color: '#00e5ff88', top: 'clamp(3.5rem, 8vw, 5rem)', left: 'clamp(5rem, 12vw, 6rem)', fontSize: 'var(--hud-text-size)' }}>
        <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 3 }}>
          SYS.STATUS: NOMINAL
        </motion.div>
        <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}>
          NET.SEC: TLS 1.3
        </motion.div>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 3, delay: 1 }}>
          PWR: 98.7%
        </motion.div>
      </div>

      {/* Top-right HUD readouts */}
      <div className="absolute font-mono text-right leading-relaxed tracking-wider" style={{ color: '#00e5ff88', top: 'clamp(3.5rem, 8vw, 5rem)', right: 'clamp(3rem, 6vw, 5rem)', fontSize: 'var(--hud-text-size)' }}>
        <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 2.5 }}>
          ALT: 012.4m
        </motion.div>
        <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.4 }}>
          HDG: 247°
        </motion.div>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.8 }}>
          SPD: 001.2 kn
        </motion.div>
      </div>

      {/* Bottom-left tick marks */}
      <div className="absolute flex gap-[3px] items-end" style={{ bottom: 'clamp(3rem, 6vw, 5rem)', left: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
        {[12, 8, 14, 10, 16, 9, 11, 13, 7, 15].map((h, i) => (
          <motion.div
            key={i}
            className="w-[2px]"
            style={{ backgroundColor: '#00e5ff44' }}
            animate={{ height: [h, h + 6, h] }}
            transition={{ repeat: Infinity, duration: 2, delay: i * 0.15 }}
          />
        ))}
      </div>

      {/* Bottom-right system text */}
      <div className="absolute font-mono tracking-[0.3em] uppercase text-right" style={{ color: '#00e5ff55', bottom: 'clamp(3rem, 6vw, 5rem)', right: 'clamp(0.75rem, 2vw, 1.5rem)', fontSize: 'var(--hud-readout-size)' }}>
        <motion.div animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ repeat: Infinity, duration: 4 }}>
          QUANTUM ENTANGLEMENT ACTIVE
        </motion.div>
      </div>

      {/* Scan line */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
        <motion.div
          className="absolute left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #00e5ff, transparent)' }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
        />
      </div>

      {/* Subtle noise overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.015'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay',
          opacity: 0.3,
        }}
      />
    </div>
  )
}

/* ═══════════════════ CORNER BRACKET ═══════════════════ */

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

function CornerBracket({ position }: { position: Position }): React.JSX.Element {
  const size = 'var(--hud-corner-size)'
  const thickness = 1

  const positionClasses: Record<Position, string> = {
    'top-left': 'top-12 left-4',
    'top-right': 'top-12 right-4',
    'bottom-left': 'bottom-16 left-4',
    'bottom-right': 'bottom-16 right-4',
  }

  const responsivePositions: Record<Position, React.CSSProperties> = {
    'top-left': { top: 'clamp(2rem, 4vw, 3rem)', left: 'clamp(0.5rem, 1.5vw, 1rem)' },
    'top-right': { top: 'clamp(2rem, 4vw, 3rem)', right: 'clamp(0.5rem, 1.5vw, 1rem)' },
    'bottom-left': { bottom: 'clamp(2.5rem, 5vw, 4rem)', left: 'clamp(0.5rem, 1.5vw, 1rem)' },
    'bottom-right': { bottom: 'clamp(2.5rem, 5vw, 4rem)', right: 'clamp(0.5rem, 1.5vw, 1rem)' },
  }

  const transforms: Record<Position, string> = {
    'top-left': '',
    'top-right': 'scaleX(-1)',
    'bottom-left': 'scaleY(-1)',
    'bottom-right': 'scale(-1, -1)',
  }

  return (
    <motion.div
      className="absolute"
      style={{ transform: transforms[position], ...responsivePositions[position] }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Horizontal line with glow */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: size,
          height: `${thickness}px`,
          background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.6), rgba(0, 212, 255, 0.1))',
          boxShadow: '0 0 8px rgba(0, 212, 255, 0.3)',
        }}
      />
      {/* Vertical line with glow */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: `${thickness}px`,
          height: size,
          background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.6), rgba(0, 212, 255, 0.1))',
          boxShadow: '0 0 8px rgba(0, 212, 255, 0.3)',
        }}
      />
      {/* Tick marks along the bracket */}
      {[10, 20, 30].map((pos) => (
        <div
          key={pos}
          className="absolute"
          style={{
            left: `${pos}px`,
            top: -3,
            width: thickness + 1,
            height: 3,
            backgroundColor: 'rgba(0, 212, 255, 0.3)',
          }}
        />
      ))}
    </motion.div>
  )
}
