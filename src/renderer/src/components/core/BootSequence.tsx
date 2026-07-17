import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '@/utils/AudioEngine'

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [particles, setParticles] = useState<{ x: number; y: number; size: number; delay: number }[]>([])

  // Generate floating particles
  useEffect(() => {
    const p = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      delay: Math.random() * 5,
    }))
    setParticles(p)
  }, [])

  useEffect(() => {
    audioEngine.playBootSequence()
    const t1 = setTimeout(() => setStep(1), 400)
    const t2 = setTimeout(() => setStep(2), 1000)
    const t3 = setTimeout(() => setStep(3), 1600)
    const t4 = setTimeout(() => setStep(4), 2200)
    const t5 = setTimeout(() => setStep(5), 3000)
    const t6 = setTimeout(() => setStep(6), 3500)
    return () => [t1, t2, t3, t4, t5, t6].forEach(clearTimeout)
  }, [])

  const hasPlayedExit = useRef(false)
  
  useEffect(() => {
    if (step === 6 && !hasPlayedExit.current) {
      hasPlayedExit.current = true
      audioEngine.playBootSequence()
      setTimeout(onComplete, 600)
    }
  }, [step, onComplete])

  return (
    <div className="fixed inset-0 w-screen h-screen bg-astryx-obsidian flex items-center justify-center overflow-hidden z-[9999]">
      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: '#00e5ff',
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: 0.3,
            boxShadow: '0 0 6px #00e5ff44',
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            repeat: Infinity,
            duration: 3 + p.delay,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Background Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: step < 6 ? 0.05 : 0 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,1)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      {/* Step 1: Hexagon fragments converging */}
      <AnimatePresence>
        {step < 2 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={`hex-${i}`}
                className="absolute border"
                style={{
                  width: 30,
                  height: 30,
                  borderColor: '#00e5ff33',
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                }}
                initial={{
                  x: (Math.random() - 0.5) * 600,
                  y: (Math.random() - 0.5) * 600,
                  opacity: 0,
                  rotate: Math.random() * 360,
                }}
                animate={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  rotate: 0,
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Core Assembly */}
      <AnimatePresence>
        {step >= 1 && step < 6 && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 2, opacity: 0, filter: 'blur(20px)' }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center"
            style={{ width: 'var(--orb-size-max)', height: 'var(--orb-size-max)', maxWidth: '520px', maxHeight: '520px' }}
          >
            {/* Outer dotted ring */}
            <motion.svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full"
              style={{ color: '#00e5ff33' }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
            >
              <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" />
            </motion.svg>

            {/* Segmented ring */}
            <motion.svg
              viewBox="0 0 100 100"
              className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]"
              style={{ color: '#00e5ff66' }}
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
            >
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="15 5 5 5" />
            </motion.svg>

            {/* Inner solid ring */}
            <motion.svg
              viewBox="0 0 100 100"
              className="absolute inset-8 w-[calc(100%-4rem)] h-[calc(100%-4rem)]"
              style={{ color: '#00e5ff' }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
            >
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="50 10" />
            </motion.svg>

            {/* Power core glow */}
            <motion.div
              animate={{
                opacity: [0.2, 0.6, 0.2],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute w-32 h-32 rounded-full mix-blend-screen"
              style={{
                backgroundColor: '#00e5ff',
                filter: 'blur(40px)',
              }}
            />

            {/* Second core layer */}
            <motion.div
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.3, 1],
              }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', delay: 0.5 }}
              className="absolute w-48 h-48 rounded-full mix-blend-screen"
              style={{
                backgroundColor: '#a855f7',
                filter: 'blur(60px)',
              }}
            />

            {/* Center Text */}
            <div className="absolute text-center flex flex-col items-center justify-center z-10">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={step >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ delay: 0.5 }}
                className="font-display tracking-[0.3em] font-bold text-cyber text-center"
                style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
              >
                ASTRYX
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={step >= 3 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="font-mono text-[8px] tracking-[0.5em] text-astryx-platinum mt-1 uppercase text-glow"
              >
                Mark III System
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Output */}
      <AnimatePresence>
        {step >= 0 && step < 6 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute font-mono tracking-[0.2em] p-4 glass-premium rounded-lg shadow-2xl"
            style={{ bottom: 'clamp(2rem, 5vw, 3rem)', left: 'clamp(0.75rem, 2vw, 3rem)', fontSize: 'clamp(7px, 0.8vw, 10px)', color: '#00e5ff', background: 'rgba(0,10,20,0.4)' }}
          >
            {step >= 0 && <motion.div className="mb-1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>&gt; INIT // KERNEL LOAD...</motion.div>}
            {step >= 1 && <motion.div className="mb-1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>&gt; HUD // ASSEMBLING VIRTUAL OVERLAY... [OK]</motion.div>}
            {step >= 2 && <motion.div className="mb-1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>&gt; SYS // BYPASSING SECURITY PROTOCOLS... [DONE]</motion.div>}
            {step >= 3 && <motion.div className="mb-1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>&gt; ENGINE // IGNITING CORE... [ACTIVE]</motion.div>}
            {step >= 4 && <motion.div className="mb-1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>&gt; NEURAL // SYNCHRONIZING QUANTUM MATRIX...</motion.div>}
            {step >= 5 && <motion.div className="mb-1 text-astryx-platinum" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>&gt; ASTRYX IS ONLINE.</motion.div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right-side system diagnostics */}
      <AnimatePresence>
        {step >= 2 && step < 6 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute font-mono text-right leading-relaxed p-4 glass-premium rounded-lg shadow-2xl"
            style={{ color: '#00e5ff', bottom: 'clamp(2rem, 5vw, 3rem)', right: 'clamp(0.75rem, 2vw, 3rem)', fontSize: 'clamp(6px, 0.7vw, 8px)', background: 'rgba(0,10,20,0.4)' }}
          >
            <div>SYS.CLOCK: {new Date().toLocaleTimeString()}</div>
            <div>CORE.TEMP: 37.2°C</div>
            <div>PWR.DRAW: 98.4%</div>
            <div>MEM.ALLOC: 2.4/8.0 GB</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final Flash */}
      {step === 6 && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-0 z-50 mix-blend-screen pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, #ffffff 0%, #00e5ff 30%, transparent 80%)' }}
        />
      )}
    </div>
  )
}
