import re
import os

# --- 1. index.css ---
css_path = 'c:/My_Project/Jarvis/src/renderer/src/index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

liquid_bg_css = """
/* Liquid Aurora Background */
.liquid-bg {
  background: #020611;
  position: absolute;
  inset: 0;
  z-index: -2;
  overflow: hidden;
}
.liquid-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.5;
  animation: float-orb 40s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}
.liquid-orb-1 { width: 60vw; height: 60vw; background: #00d4ff; top: -10vw; left: -10vw; animation-delay: 0s; }
.liquid-orb-2 { width: 70vw; height: 70vw; background: #9222e0; bottom: -20vw; right: -10vw; animation-delay: -10s; }
.liquid-orb-3 { width: 50vw; height: 50vw; background: #0044ff; top: 20%; left: 30%; animation-delay: -20s; }

@keyframes float-orb {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(10vw, -10vw) scale(1.1); }
  66% { transform: translate(-10vw, 10vw) scale(0.9); }
  100% { transform: translate(15vw, 15vw) scale(1.05); }
}

/* Glass Shimmer on hover */
.glass-shimmer {
  position: relative;
  overflow: hidden;
}
.glass-shimmer::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
  transform: skewX(-20deg);
  transition: left 0.7s ease;
}
.glass-shimmer:hover::after {
  left: 200%;
}

/* 3D Glass Sphere */
.glass-sphere {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  box-shadow: 
    inset 0 0 40px rgba(255, 255, 255, 0.1),
    inset 0 20px 40px rgba(255, 255, 255, 0.15),
    inset 0 -20px 40px rgba(0, 212, 255, 0.1),
    0 20px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}
.glass-sphere::before {
  content: '';
  position: absolute;
  top: 2%; left: 10%; width: 80%; height: 40%;
  border-radius: 50%;
  background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
  pointer-events: none;
}
"""

if "Liquid Aurora Background" not in css_content:
    css_content += "\n" + liquid_bg_css

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css_content)

# --- 2. App.tsx ---
app_path = 'c:/My_Project/Jarvis/src/renderer/src/App.tsx'
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

new_app_bg = """    <div 
      className="relative w-[100vw] h-[100vh] overflow-hidden transition-all duration-1000 bg-[#020611]" 
      id="astryx-root"
      style={{ opacity: glowIntensity }}
    >
      <div className="liquid-bg">
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
      </div>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_80%,rgba(0,212,255,0.1)_0%,transparent_50%),radial-gradient(circle_at_20%_80%,rgba(146,34,224,0.1)_0%,transparent_50%)] mix-blend-screen" />
"""
app_content = re.sub(r'<div\s+className="relative w-\[100vw\] h-\[100vh\] overflow-hidden transition-all duration-1000".*?mix-blend-screen" />', new_app_bg, app_content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

# --- 3. AIOrb.tsx ---
ai_orb_path = 'c:/My_Project/Jarvis/src/renderer/src/components/core/AIOrb.tsx'
ai_orb_code = """import { useJarvisStore, type OrbState } from '@/stores/jarvis.store'
import { motion } from 'framer-motion'

const STATE_COLORS: Record<OrbState, string> = {
  standby: '#ffffff',     // White
  listening: '#00d4ff',   // Cyan
  processing: '#9222e0',  // Violet
  speaking: '#00d4ff',    // Cyan
  executing: '#0fba81',   // Emerald
  error: '#ed4444',       // Red
  model_swap: '#f97316',  // Orange
  ar_mode: '#ffffff'      // White
}

export function AIOrb() {
  const orbState = useJarvisStore((s) => s.orbState)
  const colorStr = STATE_COLORS[orbState] || STATE_COLORS.standby

  // Pulsing scale for processing
  const coreScale = orbState === 'processing' ? [0.9, 1.3, 0.9] : 1
  const blurAmount = orbState === 'listening' ? 'blur(20px)' : 'blur(40px)'

  return (
    <div className="w-full h-full flex items-center justify-center relative pointer-events-none">
      
      {/* 3D Container */}
      <motion.div 
        className="relative w-[400px] h-[400px] flex items-center justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }} // smooth cinematic spring
      >
        
        {/* The 3D Glass Sphere Shell */}
        <div className="absolute inset-8 glass-sphere z-20" />

        {/* The Liquid Energy Core */}
        <motion.div 
          className="absolute z-10 rounded-full mix-blend-screen"
          style={{ backgroundColor: colorStr, width: '180px', height: '180px', filter: blurAmount }}
          animate={{ 
            opacity: orbState === 'listening' ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
            scale: coreScale
          }}
          transition={{ repeat: Infinity, duration: orbState === 'processing' ? 1.5 : 4, ease: "easeInOut" }}
        />

        {/* Secondary Core Core */}
        <motion.div 
          className="absolute z-10 rounded-full bg-white mix-blend-overlay filter blur-[10px]"
          style={{ width: '80px', height: '80px' }}
          animate={{ scale: coreScale, opacity: [0.5, 0.9, 0.5] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />

        {/* High-Tech Orbital Rings (Subtle, clipping through glass) */}
        <motion.svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-20 z-0" style={{ color: colorStr }} animate={{ rotate: 360, rotateX: 60, rotateY: 20 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }}>
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1 5" />
        </motion.svg>

        <motion.svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-30 z-30" style={{ color: colorStr }} animate={{ rotate: -360, rotateX: -40, rotateY: 10 }} transition={{ repeat: Infinity, duration: 15, ease: "linear" }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="20 10 2 10" />
        </motion.svg>

        {/* Text Layer - Floats in front of glass */}
        <div className="absolute flex flex-col items-center justify-center z-40">
          <motion.div 
            className="font-display text-5xl tracking-[0.3em] font-light text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]"
            animate={{ 
              textShadow: orbState === 'listening' 
                ? [`0 0 10px ${colorStr}`, `0 0 30px ${colorStr}`, `0 0 10px ${colorStr}`] 
                : `0 0 15px rgba(255,255,255,0.8)`
            }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            ASTRYX
          </motion.div>
          <div className="font-mono text-[8px] tracking-[0.5em] text-white/60 mt-3 uppercase">
            {orbState} // CORE
          </div>
        </div>

      </motion.div>

      {/* Decorative Outer HUD Elements */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        <div className="absolute top-12 left-12 font-mono text-[9px] text-white/50 tracking-[0.3em]">SYS.LOC // 45.912, -12.441</div>
        <div className="absolute bottom-12 right-12 font-mono text-[9px] text-white/50 tracking-[0.3em]">NET.UPLINK // SECURE</div>
        <div className="absolute top-12 right-12 font-mono text-[9px] text-white/50 tracking-[0.3em]">ORB.STATE // {orbState.toUpperCase()}</div>
      </div>
    </div>
  )
}
"""

with open(ai_orb_path, 'w', encoding='utf-8') as f:
    f.write(ai_orb_code)

print("Masterpiece UI updated successfully.")
