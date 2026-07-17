import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'

interface VoiceInfo {
  name: string
  locale: string
  gender: string
  friendly_name: string
  categories: string[]
  personality: string
}

import { getShortcutForVoice } from '@/hooks/useVoiceShortcuts'
import { VoiceProfiles } from '@/components/voice/VoiceProfiles'
import { VoiceLearning } from '@/components/voice/VoiceLearning'
import { PronunciationEditor } from '@/components/voice/PronunciationEditor'

interface VoiceSettingsProps {
  onClose: () => void
}

export function VoiceSettings({ onClose }: VoiceSettingsProps): React.JSX.Element {
  const ws = useJarvisStore((s) => s.ws)
  const selectedVoice = useJarvisStore((s) => s.selectedVoice)
  const setSelectedVoice = useJarvisStore((s) => s.setSelectedVoice)

  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [localeFilter, setLocaleFilter] = useState<string>('all')
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [currentVoice, setCurrentVoice] = useState<string>(selectedVoice)
  const [saving, setSaving] = useState(false)
  const [showProfiles, setShowProfiles] = useState(false)
  const [showLearning, setShowLearning] = useState(false)
  const [showPronunciation, setShowPronunciation] = useState(false)
  const [showVad, setShowVad] = useState(false)
  const vadSensitivity = useJarvisStore((s) => s.vadSensitivity)
  const setVadSensitivity = useJarvisStore((s) => s.setVadSensitivity)
  const vadSenseLabel = vadSensitivity <= 3 ? 'Very Sensitive (Quiet)' : vadSensitivity <= 6 ? 'Balanced' : 'Strict (Noisy)'

  // Fetch voices from backend
  const fetchVoices = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    setLoading(true)
    ws.send(JSON.stringify({ type: 'list_voices', payload: {} }))
  }, [ws])

  useEffect(() => {
    fetchVoices()
    // Also sync VAD config from backend on mount
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'get_vad', payload: {} }))
    }
  }, [fetchVoices, ws])

  // Listen for voice list response
  useEffect(() => {
    if (!ws) return
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'voices_list') {
          setVoices(msg.payload?.voices || [])
          if (msg.payload?.current?.name) {
            setCurrentVoice(msg.payload.current.name)
          }
          setLoading(false)
        } else if (msg.type === 'voice_set') {
          if (msg.payload?.success) {
            setCurrentVoice(msg.payload.voice)
            setSelectedVoice(msg.payload.voice)
            setSaving(false)
            audioEngine.playSuccess()
          }
        } else if (msg.type === 'vad_config') {
          const backendVal = msg.payload?.sensitivity
          if (typeof backendVal === 'number' && backendVal >= 1 && backendVal <= 10) {
            setVadSensitivity(backendVal)
          }
        }
      } catch { /* ignore */ }
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [ws, setSelectedVoice])

  // Set voice on backend
  const handleSelectVoice = (voiceName: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    audioEngine.playClick()
    setSaving(true)
    ws.send(JSON.stringify({ type: 'set_voice', payload: { voice: voiceName } }))
  }

  // Preview voice using Web Speech API (approximate)
  const handlePreviewVoice = (e: React.MouseEvent, voiceName: string) => {
    e.stopPropagation()
    audioEngine.playClick()
    setPreviewing(voiceName)
    const utterance = new SpeechSynthesisUtterance("Hello sir. I am Astryx, at your service.")
    utterance.lang = voiceName.startsWith('en-GB') ? 'en-GB' : 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onend = () => setPreviewing(null)
    utterance.onerror = () => setPreviewing(null)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  // Extract unique locales for filter
  const locales = ['all', ...new Set(voices.map(v => v.locale))].sort()

  // Filter voices
  const filteredVoices = voices.filter(v => {
    if (localeFilter !== 'all' && v.locale !== localeFilter) return false
    if (genderFilter !== 'all' && v.gender.toLowerCase() !== genderFilter.toLowerCase()) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        v.name.toLowerCase().includes(q) ||
        v.friendly_name.toLowerCase().includes(q) ||
        v.locale.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Group by locale
  const groupedVoices: Record<string, VoiceInfo[]> = {}
  filteredVoices.forEach(v => {
    const key = v.locale
    if (!groupedVoices[key]) groupedVoices[key] = []
    groupedVoices[key].push(v)
  })

  const isCurrent = (name: string) => name === currentVoice

  // Locale display names
  const localeName = (locale: string): string => {
    const names: Record<string, string> = {
      'en-GB': '🇬🇧 English (UK)',
      'en-US': '🇺🇸 English (US)',
      'en-AU': '🇦🇺 English (Australia)',
      'en-CA': '🇨🇦 English (Canada)',
      'en-IN': '🇮🇳 English (India)',
      'fr-FR': '🇫🇷 French',
      'de-DE': '🇩🇪 German',
      'es-ES': '🇪🇸 Spanish',
      'it-IT': '🇮🇹 Italian',
      'pt-BR': '🇧🇷 Portuguese (Brazil)',
      'ja-JP': '🇯🇵 Japanese',
      'ko-KR': '🇰🇷 Korean',
      'zh-CN': '🇨🇳 Chinese',
      'ar-SA': '🇸🇦 Arabic',
      'ru-RU': '🇷🇺 Russian',
    }
    return names[locale] || locale
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] pointer-events-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-[700px] max-h-[80vh] flex flex-col panel-luxury border-[#00e5ff]/40 shadow-[0_0_60px_rgba(0,229,255,0.15)]"
        style={{ background: 'linear-gradient(180deg, #001224 0%, #00050d 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#00e5ff]/40 flex items-center justify-center">
              <span className="text-[14px]">🎙️</span>
            </div>
            <div>
              <h2 className="font-display text-[13px] text-white tracking-[0.25em] font-bold uppercase">Voice Settings</h2>
              <p className="font-mono text-[8px] text-[#00e5ff]/60 tracking-wider">AI VOICE SYNTHESIS • {voices.length} VOICES</p>
            </div>
          </div>
          <button
            onClick={() => { audioEngine.playClick(); onClose() }}
            className="w-8 h-8 rounded-full border border-white/10 hover:border-white/30 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Current Voice Badge */}
        {/* Pronunciation Editor Toggle */}
        <button
          onClick={() => { audioEngine.playClick(); setShowPronunciation(!showPronunciation) }}
          className={`w-full px-5 py-2 flex items-center justify-between border-b border-white/5 transition-all cursor-pointer hover:bg-white/[0.02] ${
            showPronunciation ? 'bg-[#f59e0b]/5' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px]">🔤</span>
            <span className="font-mono text-[9px] text-white/70 tracking-wider uppercase font-bold">Pronunciation</span>
            <span className="font-mono text-[7px] text-[#f59e0b]/60">({useJarvisStore.getState().pronunciations.length})</span>
          </div>
          <span className={`text-[8px] text-white/30 transition-transform ${showPronunciation ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Pronunciation Editor Section */}
        {showPronunciation && (
          <div className="border-b border-white/5" style={{ minHeight: '300px', maxHeight: '450px' }}>
            <PronunciationEditor onClose={() => setShowPronunciation(false)} />
          </div>
        )}

        {/* Learning Mode Toggle */}
        <button
          onClick={() => { audioEngine.playClick(); setShowLearning(!showLearning) }}
          className={`w-full px-5 py-2 flex items-center justify-between border-b border-white/5 transition-all cursor-pointer hover:bg-white/[0.02] ${
            showLearning ? 'bg-[#a78bfa]/5' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px]">🧠</span>
            <span className="font-mono text-[9px] text-white/70 tracking-wider uppercase font-bold">Voice Learning</span>
            <span className="font-mono text-[7px] text-[#a78bfa]/60">({useJarvisStore.getState().learningCorrections.length})</span>
          </div>
          <span className={`text-[8px] text-white/30 transition-transform ${showLearning ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Learning Mode Section */}
        {showLearning && (
          <div className="border-b border-white/5" style={{ minHeight: '300px', maxHeight: '450px' }}>
            <VoiceLearning onClose={() => setShowLearning(false)} />
          </div>
        )}

        {/* VAD Sensitivity Toggle */}
        <button
          onClick={() => { audioEngine.playClick(); setShowVad(!showVad) }}
          className={`w-full px-5 py-2 flex items-center justify-between border-b border-white/5 transition-all cursor-pointer hover:bg-white/[0.02] ${
            showVad ? 'bg-[#10b981]/5' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px]">🎚️</span>
            <span className="font-mono text-[9px] text-white/70 tracking-wider uppercase font-bold">VAD Sensitivity</span>
            <span className="font-mono text-[7px] text-[#10b981]/60">{vadSensitivity}/10</span>
          </div>
          <span className={`text-[8px] text-white/30 transition-transform ${showVad ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* VAD Sensitivity Section */}
        {showVad && (
          <div className="px-5 py-4 border-b border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] text-white/50 tracking-wider uppercase">
                {vadSenseLabel}
              </span>
              <span className="font-mono text-[10px] text-[#10b981] font-bold">{vadSensitivity}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={vadSensitivity}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setVadSensitivity(val)
                if (ws?.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'set_vad', payload: { sensitivity: val } }))
                }
              }}
              className="w-full h-1.5 appearance-none rounded-full bg-white/10 outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10b981]
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(16,185,129,0.4)]
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex items-center justify-between text-[7px] font-mono tracking-wider">
              <span className="text-white/40">🔈 Most Sensitive</span>
              <span className="text-white/60">(quiet rooms)</span>
              <span className="text-white/40">🔊 Most Strict</span>
            </div>
            <div className="text-[7px] font-mono text-white/30 leading-relaxed tracking-wider">
              {vadSensitivity <= 3
                ? 'Best for quiet environments. Catches very soft speech.'
                : vadSensitivity <= 6
                  ? 'Balanced for typical room conditions.'
                  : 'Best for noisy environments. Requires louder speech to trigger.'}
            </div>
          </div>
        )}

        {/* Profiles Toggle */}
        <button
          onClick={() => { audioEngine.playClick(); setShowProfiles(!showProfiles) }}
          className={`w-full px-5 py-2 flex items-center justify-between border-b border-white/5 transition-all cursor-pointer hover:bg-white/[0.02] ${
            showProfiles ? 'bg-[#00e5ff]/3' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px]">🎭</span>
            <span className="font-mono text-[9px] text-white/70 tracking-wider uppercase font-bold">Voice Profiles</span>
            <span className="font-mono text-[7px] text-white/30">({useJarvisStore.getState().voiceProfiles.length})</span>
          </div>
          <span className={`text-[8px] text-white/30 transition-transform ${showProfiles ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Profiles Section */}
        {showProfiles && (
          <div className="px-4 py-3 border-b border-white/5">
            <VoiceProfiles onSelectVoice={handleSelectVoice} />
          </div>
        )}

        {/* Current Voice Badge */}
        <div className="px-5 py-3 border-b border-white/5 shrink-0 bg-[#00e5ff]/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-white/40 tracking-wider uppercase">Active Voice:</span>
              <span className="font-mono text-[10px] text-[#00e5ff] font-bold tracking-wide">{currentVoice}</span>
            </div>
            {saving && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-t border-[#00e5ff] rounded-full animate-spin" />
                <span className="font-mono text-[8px] text-[#00e5ff]/60">APPLYING...</span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-white/5 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); audioEngine.playKeyboardTyping() }}
            placeholder="Search voices by name, locale..."
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-mono text-white focus:outline-none focus:border-[#00e5ff]/40 placeholder-white/20 tracking-wider"
          />
          <select
            value={localeFilter}
            onChange={(e) => { setLocaleFilter(e.target.value); audioEngine.playClick() }}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[9px] font-mono text-white/80 focus:outline-none focus:border-[#00e5ff]/40 cursor-pointer"
          >
            {locales.map(l => (
              <option key={l} value={l} className="bg-[#001224]">
                {l === 'all' ? '🌐 All Locales' : localeName(l)}
              </option>
            ))}
          </select>
          <select
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); audioEngine.playClick() }}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[9px] font-mono text-white/80 focus:outline-none focus:border-[#00e5ff]/40 cursor-pointer"
          >
            <option value="all">⚤ All</option>
            <option value="male">♂ Male</option>
            <option value="female">♀ Female</option>
          </select>
        </div>

        {/* Voice List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-t-2 border-[#00e5ff] rounded-full animate-spin mx-auto" />
                <div className="font-mono text-[8px] text-[#00e5ff]/60 tracking-widest uppercase">Fetching available voices...</div>
              </div>
            </div>
          ) : Object.keys(groupedVoices).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
              <span className="text-2xl mb-2">🎤</span>
              <span className="font-mono text-[9px] tracking-wider">No voices match your filter</span>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedVoices).map(([locale, localeVoices]) => (
                <div key={locale}>
                  <div className="flex items-center gap-2 px-2 py-1.5 sticky top-0 bg-[#001224] z-10 border-b border-white/5">
                    <span className="font-mono text-[9px] text-[#00e5ff]/80 tracking-wider font-bold uppercase">
                      {localeName(locale)}
                    </span>
                    <span className="text-[7px] text-white/30 font-mono">({localeVoices.length})</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    {localeVoices.map((voice) => (
                      <motion.button
                        key={voice.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleSelectVoice(voice.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer text-left ${
                          isCurrent(voice.name)
                            ? 'border-[#00e5ff]/50 bg-[#00e5ff]/10 shadow-[0_0_12px_rgba(0,229,255,0.08)]'
                            : 'border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Gender icon */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] border shrink-0 ${
                          voice.gender === 'Female'
                            ? 'border-[#ec4899]/30 bg-[#ec4899]/10'
                            : 'border-[#3b82f6]/30 bg-[#3b82f6]/10'
                        }`}>
                          {voice.gender === 'Female' ? '♀' : '♂'}
                        </div>

                        {/* Voice info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-[10px] font-bold ${
                              isCurrent(voice.name) ? 'text-[#00e5ff]' : 'text-white/90'
                            }`}>
                              {voice.name}
                            </span>
                            {isCurrent(voice.name) && (
                              <span className="px-1.5 py-0.5 rounded text-[6px] font-mono tracking-widest bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 uppercase">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] text-white/40 font-mono truncate mt-0.5 tracking-wide">
                            {voice.friendly_name}
                          </div>
                        </div>

                        {/* Shortcut badge */}
                        {getShortcutForVoice(voice.name) && (
                          <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#00e5ff]/25 bg-[#00e5ff]/8">
                            <span className="text-[6px] font-mono text-[#00e5ff]/70 font-bold tracking-wider uppercase">
                              Ctrl+{getShortcutForVoice(voice.name)}
                            </span>
                          </div>
                        )}

                        {/* Tags */}
                        <div className="flex items-center gap-1.5">
                          {voice.categories.length > 0 && (
                            <div className="hidden md:flex gap-1">
                              {voice.categories.slice(0, 2).map(cat => (
                                <span key={cat} className="px-1.5 py-0.5 rounded text-[6px] font-mono tracking-wider border border-white/10 text-white/40 uppercase">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                          {voice.personality && (
                            <span className="hidden lg:block px-1.5 py-0.5 rounded text-[6px] font-mono tracking-wider bg-[#00e5ff]/10 text-[#00e5ff]/60 border border-[#00e5ff]/20 uppercase">
                              {voice.personality}
                            </span>
                          )}
                          {/* Preview button */}
                          <button
                            onClick={(e) => handlePreviewVoice(e, voice.name)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                              previewing === voice.name
                                ? 'border-[#00e5ff] bg-[#00e5ff]/20 text-[#00e5ff] animate-pulse'
                                : 'border-white/10 hover:border-white/30 text-white/40 hover:text-white'
                            }`}
                            title="Preview voice"
                          >
                            <span className="text-[8px]">{previewing === voice.name ? '⟳' : '▶'}</span>
                          </button>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <div className="font-mono text-[7px] text-white/30 tracking-wider">
            {voices.length} voices available • Powered by Microsoft Edge TTS
          </div>
          <button
            onClick={() => { audioEngine.playClick(); onClose() }}
            className="px-4 py-1.5 rounded border border-white/10 hover:border-white/30 text-white/60 hover:text-white font-mono text-[8px] tracking-widest uppercase transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
