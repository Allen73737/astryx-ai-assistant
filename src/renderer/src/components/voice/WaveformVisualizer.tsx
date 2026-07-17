import { memo } from 'react'
import { motion } from 'framer-motion'
import { useVoiceStore } from '@/stores/voice.store'
import { useJarvisStore } from '@/stores/jarvis.store'

const BAR_COUNT = 32
const MIN_BAR_HEIGHT = 2
const MAX_BAR_HEIGHT = 28

const WaveformBar = memo(function WaveformBar({
  height,
  color,
  isIdle,
}: {
  height: number
  color: string
  isIdle: boolean
}) {
  return (
    <div
      className="w-[2px] rounded-full origin-bottom"
      style={{
        backgroundColor: color,
        height: `${height}px`,
        opacity: isIdle ? 0.15 : 1,
        boxShadow: !isIdle && height > 15 ? `0 0 4px ${color}` : 'none',
        transition: 'height 75ms linear, background-color 200ms ease, opacity 200ms ease',
      }}
    />
  )
})

/* Speaking state uses a pre-defined keyframe array — no Date.now() in render */
const SPEAKING_HEIGHTS = new Array(BAR_COUNT).fill(0).map((_, i) => {
  const phase = (i / BAR_COUNT) * Math.PI * 2
  return Math.max(MIN_BAR_HEIGHT, (Math.sin(phase) * 0.35 + 0.65) * 14)
})

/**
 * WaveformVisualizer — Live audio level display for the bottom bar.
 *
 * Three states:
 * - idle/standby: dim static bars
 * - listening: animated bars reacting to real waveform data from voice store
 * - speaking: gentle pulsing wave pattern (animated via framer-motion keyframes)
 * - processing: slightly elevated static bars
 */
export function WaveformVisualizer(): React.JSX.Element {
  const waveformData = useVoiceStore((s) => s.waveformData)
  const volume = useVoiceStore((s) => s.volume)
  const orbState = useJarvisStore((s) => s.orbState)

  const isListening = orbState === 'listening'
  const isSpeaking = orbState === 'speaking'
  const isIdle = orbState === 'standby'
  const isProcessing = orbState === 'processing'

  const getBarHeight = (index: number): number => {
    if (isSpeaking) {
      return SPEAKING_HEIGHTS[index]
    }
    if (isIdle) {
      return 1
    }
    if (isProcessing) {
      return 4
    }
    // Listening: react to live waveform data
    const dataIdx = Math.floor((index / BAR_COUNT) * waveformData.length)
    const rawValue = waveformData[dataIdx] || 0
    const mix = rawValue * 0.6 + volume * 20 * 0.4
    return Math.max(MIN_BAR_HEIGHT, Math.min(MAX_BAR_HEIGHT, mix))
  }

  const getBarColor = (index: number): string => {
    if (isSpeaking) return 'rgba(0, 229, 255, 0.6)'
    if (isProcessing) return 'rgba(0, 136, 204, 0.5)'
    if (isListening) {
      const height = getBarHeight(index)
      const intensity = (height - MIN_BAR_HEIGHT) / (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)
      if (intensity > 0.6) return 'rgba(0, 229, 255, 0.9)'
      if (intensity > 0.3) return 'rgba(0, 229, 255, 0.6)'
      return 'rgba(0, 229, 255, 0.3)'
    }
    return 'rgba(0, 229, 255, 0.06)'
  }

  return (
    <div className="relative flex items-center gap-[2px] h-7 min-w-[60px] max-w-[90px]">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <WaveformBar
          key={i}
          height={getBarHeight(i)}
          color={getBarColor(i)}
          isIdle={isIdle}
        />
      ))}

      {/* Speaking glow overlay */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 rounded-sm pointer-events-none"
          animate={{
            boxShadow: [
              'inset 0 0 4px rgba(0, 229, 255, 0.1)',
              'inset 0 0 10px rgba(0, 229, 255, 0.25)',
              'inset 0 0 4px rgba(0, 229, 255, 0.1)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
