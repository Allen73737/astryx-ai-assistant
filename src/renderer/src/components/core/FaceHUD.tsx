import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useARStore } from '@/stores/ar.store'

export function FaceHUD() {
  const faceData = useARStore((s) => s.faceData)
  const containerRef = useRef<HTMLDivElement>(null)

  if (!faceData) return null

  // Transform normalized coordinates (0-1) to viewport pixels
  const left = faceData.x * 100
  const top = faceData.y * 100
  const width = faceData.width * 100
  const height = faceData.height * 100

  // The coordinates from MediaPipe are usually mirrored if using front camera,
  // but for a desktop assistant we just want to track the box in screen space.
  
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden" ref={containerRef}>
      <motion.div
        className="absolute border border-jarvis-cyan/40"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}vw`,
          height: `${height}vh`,
          x: '-50%',
          y: '-50%',
        }}
        animate={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}vw`,
          height: `${height}vh`
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Reticles at corners */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-jarvis-cyan" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-jarvis-cyan" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-jarvis-cyan" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-jarvis-cyan" />
        
        {/* Targeting Info */}
        <div className="absolute top-full left-0 mt-2 font-mono text-[9px] text-jarvis-cyan tracking-widest uppercase bg-jarvis-cyan/10 px-2 py-1 rounded">
          Subject: Authorized
          <br />
          Dist: {(1 / faceData.width).toFixed(2)}m
        </div>
      </motion.div>
    </div>
  )
}
