import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'
import { VoiceSettings } from '@/components/voice/VoiceSettings'
import { WaveformVisualizer } from '@/components/voice/WaveformVisualizer'

export function BottomBar(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const addMessage = useJarvisStore((s) => s.addMessage)
  const orbState = useJarvisStore((s) => s.orbState)
  const isAgentActive = useJarvisStore((s) => s.isAgentActive)
  const voiceSettingsOpen = useJarvisStore((s) => s.voiceSettingsOpen)
  const setVoiceSettingsOpen = useJarvisStore((s) => s.setVoiceSettingsOpen)
  const isLiveNotesActive = useJarvisStore((s) => s.isLiveNotesActive)
  const setActiveLab = useJarvisStore((s) => s.setActiveLab)
  const setActiveTab = useJarvisStore((s) => s.setActiveTab)

  const handleSubmit = (): void => {
    if (input.trim() && !isAgentActive) {
      const text = input.trim()
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: Date.now()
      })
      sendWsMessage('chat', { message: text })
      setInput('')
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full flex justify-center pointer-events-none" style={{ padding: '0 clamp(0.75rem, 3vw, 2.5rem) clamp(1rem, 3vw, 2rem)' }}>
      <motion.div 
        className={`w-full pointer-events-auto p-2 lg:p-3 transition-all duration-500 glass-premium ${
          inputFocused ? 'border-cyan-400/80 shadow-[0_0_40px_rgba(0,229,255,0.25)]' : ''
        }`}
        style={{
          maxWidth: 'min(48rem, 90vw)',
          borderRadius: '0.5rem',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Animated top border scan */}
        <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden">
          <motion.div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #00e5ff, transparent)',
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          />
        </div>

        <div className="flex items-end gap-4 w-full px-2 relative pb-1">
          {/* Animated chevron indicator */}
          <motion.div
            className="shrink-0 mb-1.5"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div
              className="w-3 h-3"
              style={{
                backgroundColor: inputFocused ? '#00e5ff' : '#ffffff',
                clipPath: 'polygon(100% 50%, 0 0, 0 100%)',
                boxShadow: inputFocused ? '0 0 8px rgba(0,229,255,0.6)' : 'none',
              }}
            />
          </motion.div>

          {/* Live Waveform Visualizer */}
          <WaveformVisualizer />
          
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-astryx-platinum tracking-wide placeholder:text-white/60/40 transition-all duration-300 resize-none py-1 custom-scrollbar"
            placeholder={orbState === 'executing' ? 'ASTRYX is executing...' : 'ENTER COMMAND DIRECTIVE...'}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={isAgentActive}
            style={{
              maxHeight: '150px',
              height: 'auto',
              overflowY: 'auto',
              lineHeight: '1.5'
            }}
          />

          <AnimatePresence>
            {input.trim() ? (
              <motion.button
                key="execute"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  handleSubmit()
                  audioEngine.playSuccess()
                }}
                className="px-5 py-1.5 rounded text-white font-mono text-[10px] tracking-widest uppercase hover:brightness-110 transition-all cursor-pointer mb-0.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.3), rgba(0,150,200,0.2))',
                  border: '1px solid rgba(0,229,255,0.5)',
                  boxShadow: '0 0 10px rgba(0,229,255,0.2)',
                }}
              >
                Execute
              </motion.button>
            ) : (
              <>
                {/* Voice Settings Gear - Animated */}
                <motion.button
                  key="voice-settings"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => {
                    audioEngine.playClick()
                    setVoiceSettingsOpen(true)
                  }}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    voiceSettingsOpen
                      ? 'bg-astryx-cyan/20 text-astryx-cyan shadow-[0_0_15px_rgba(0,255,255,0.3)]' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  whileHover={{ rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  title="Voice Settings"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </motion.button>

                {/* Mic Button */}
                <motion.button
                  key="mic"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => sendWsMessage('manual_voice_toggle', {})}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    orbState === 'listening' 
                      ? 'bg-astryx-cyan/20 text-astryx-cyan shadow-[0_0_15px_rgba(0,255,255,0.3)]' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  title="Toggle Voice Command"
                >
                  {orbState === 'listening' ? (
                    <motion.svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </motion.svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  )}
                </motion.button>

                {/* Live Notes Shortcut */}
                <motion.button
                  key="live-notes"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => {
                    audioEngine.playClick()
                    setActiveTab('labs')
                    setActiveLab('live-notes')
                  }}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    isLiveNotesActive
                      ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  title="Live Note Tracker"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </motion.button>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Voice Settings Modal */}
      <AnimatePresence>
        {voiceSettingsOpen && (
          <VoiceSettings onClose={() => setVoiceSettingsOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
