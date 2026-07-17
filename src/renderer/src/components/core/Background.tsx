import { useRef, useEffect, useCallback, useState } from 'react'

/* ═══════════════════ PARTICLE FIELD — 300 NODES ═══════════════════ */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  hue: number
}

function ParticleField({ width, height }: { width: number; height: number }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const mouseRef = useRef({ x: width / 2, y: height / 2 })
  const [mouseMoving, setMouseMoving] = useState(false)

  const initParticles = useCallback(() => {
    const particles: Particle[] = []
    const count = 300
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.05,
        hue: 185 + Math.random() * 40, // Cyan to teal range
      })
    }
    particlesRef.current = particles
  }, [width, height])

  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    const particles = particlesRef.current
    const connectionDistance = 120
    const mouseX = mouseRef.current.x
    const mouseY = mouseRef.current.y

    // Time-based color shift
    const time = Date.now() * 0.0001
    const hueOffset = Math.sin(time) * 10

    /* Update positions */
    for (const p of particles) {
      // Mouse attraction/repulsion
      const dx = mouseX - p.x
      const dy = mouseY - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 150 && dist > 0) {
        const force = (150 - dist) / 150 * 0.02
        p.vx += (dx / dist) * force
        p.vy += (dy / dist) * force
      }

      // Damping
      p.vx *= 0.99
      p.vy *= 0.99

      p.x += p.vx
      p.y += p.vy

      // Bounce off edges
      if (p.x < 0 || p.x > width) p.vx *= -1
      if (p.y < 0 || p.y > height) p.vy *= -1

      p.x = Math.max(0, Math.min(width, p.x))
      p.y = Math.max(0, Math.min(height, p.y))
    }

    /* Draw connections */
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < connectionDistance) {
          const opacity = (1 - dist / connectionDistance) * 0.12
          const hue = (particles[i].hue + particles[j].hue) / 2 + hueOffset
          ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${opacity})`
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.stroke()
        }
      }
    }

    /* Draw particles */
    for (const p of particles) {
      const hue = p.hue + hueOffset
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${p.opacity})`
      ctx.fill()

      // Glow for brighter particles
      if (p.radius > 1.5) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${p.opacity * 0.1})`
        ctx.fill()
      }
    }

    animFrameRef.current = requestAnimationFrame(drawParticles)
  }, [width, height])

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      setMouseMoving(true)
    }
    const handleMouseLeave = () => {
      mouseRef.current = { x: width / 2, y: height / 2 }
      setMouseMoving(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [width, height])

  useEffect(() => {
    initParticles()
    animFrameRef.current = requestAnimationFrame(drawParticles)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [initParticles, drawParticles])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  )
}

/* ═══════════════════ MAIN BACKGROUND ═══════════════════ */

export function Background(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1920, height: 1080 })

  /* Track container size with ResizeObserver */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      setSize({
        width: el.offsetWidth || 1920,
        height: el.offsetHeight || 1080,
      })
    }

    updateSize()

    const ro = new ResizeObserver(updateSize)
    ro.observe(el)

    return () => {
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden" id="jarvis-background">
      {/* Layer 1: Deep space base */}
      <div className="absolute inset-0" style={{ backgroundColor: '#00050d' }} />

      {/* Layer 2: Nebula clouds */}
      <div
        className="absolute inset-0 pointer-events-none animate-gradient"
        style={{
          background: `
            radial-gradient(ellipse at 15% 20%, rgba(0, 149, 255, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 85% 30%, rgba(168, 85, 247, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(16, 185, 129, 0.03) 0%, transparent 40%),
            radial-gradient(ellipse at 30% 60%, rgba(0, 229, 255, 0.06) 0%, transparent 45%)
          `,
        }}
      />

      {/* Layer 3: Particle field (300 nodes with mouse parallax) */}
      <ParticleField width={size.width || 1920} height={size.height || 1080} />

      {/* Layer 4: Holographic grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Layer 5: Radial atmosphere vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 30%, rgba(0, 5, 16, 0.4) 70%, rgba(0, 5, 16, 0.8) 100%)
          `,
        }}
      />

      {/* Layer 6: Scan line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px animate-scan-line"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), transparent)',
          }}
        />
      </div>
    </div>
  )
}
