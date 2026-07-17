import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'
import type { PronunciationEntry } from '@/stores/jarvis.store'

interface PronunciationEditorProps {
  onClose: () => void
}

// Example words the user might want to customize
const SUGGESTED_WORDS = [
  { word: 'ASTRYX', pronunciation: 'As-tricks', type: 'alias' as const, lang: 'en' },
  { word: 'Jarvis', pronunciation: 'ˈdʒɑːr.vɪs', type: 'phoneme' as const, lang: 'en' },
  { word: 'Malayalam', pronunciation: 'ˈmæl.ə.jɑː.ləm', type: 'phoneme' as const, lang: 'en' },
  { word: 'Qwen', pronunciation: 'kwen', type: 'alias' as const, lang: 'en' },
  { word: 'Groq', pronunciation: 'grok', type: 'alias' as const, lang: 'en' },
]

export function PronunciationEditor({ onClose }: PronunciationEditorProps): React.JSX.Element {
  const ws = useJarvisStore((s) => s.ws)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const pronunciations = useJarvisStore((s) => s.pronunciations)
  const setPronunciations = useJarvisStore((s) => s.setPronunciations)

  const [word, setWord] = useState('')
  const [pronunciation, setPronunciation] = useState('')
  const [ptype, setPtype] = useState<'alias' | 'phoneme'>('alias')
  const [lang, setLang] = useState('en')
  const [testSentence, setTestSentence] = useState('')
  const [testResult, setTestResult] = useState<{
    original: string
    ssml: string
    has_ssml: boolean
    matched_entries: Array<{ word: string; pronunciation: string; type: string }>
  } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch pronunciations
  const fetchPronunciations = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    sendWsMessage('pronunciation_list', {})
  }, [ws, sendWsMessage])

  useEffect(() => {
    fetchPronunciations()
  }, [fetchPronunciations])

  // WebSocket listeners
  useEffect(() => {
    if (!ws) return
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        const p = msg.payload || {}

        if (msg.type === 'pronunciation_list') {
          setPronunciations(p.entries || [])
        } else if (msg.type === 'pronunciation_added') {
          fetchPronunciations()
          setWord('')
          setPronunciation('')
          setMessage({ type: 'success', text: '✅ Pronunciation saved!' })
          setTimeout(() => setMessage(null), 2000)
        } else if (msg.type === 'pronunciation_deleted') {
          fetchPronunciations()
        } else if (msg.type === 'pronunciation_cleared') {
          setPronunciations([])
          setMessage({ type: 'success', text: '🗑️ All pronunciations cleared.' })
          setTimeout(() => setMessage(null), 2000)
        } else if (msg.type === 'pronunciation_test_result') {
          setTestResult({
            original: p.original || '',
            ssml: p.ssml || '',
            has_ssml: p.has_ssml || false,
            matched_entries: p.matched_entries || [],
          })
        }
      } catch { /* ignore */ }
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [ws, fetchPronunciations, setPronunciations])

  // ─── Add ──────────────────────────────────────────────────

  const handleAdd = () => {
    if (!word.trim() || !pronunciation.trim()) {
      setMessage({ type: 'error', text: 'Please fill in both the word and its pronunciation.' })
      setTimeout(() => setMessage(null), 2000)
      return
    }
    audioEngine.playSuccess()
    sendWsMessage('pronunciation_add', {
      word: word.trim(),
      pronunciation: pronunciation.trim(),
      type: ptype,
      language: lang,
    })
  }

  const handleQuickAdd = (suggestion: typeof SUGGESTED_WORDS[0]) => {
    audioEngine.playClick()
    setWord(suggestion.word)
    setPronunciation(suggestion.pronunciation)
    setPtype(suggestion.type)
    setLang(suggestion.lang)
  }

  const handleDelete = (id: string) => {
    audioEngine.playClick()
    sendWsMessage('pronunciation_delete', { id })
  }

  const handleClearAll = () => {
    if (pronunciations.length === 0) return
    audioEngine.playClick()
    sendWsMessage('pronunciation_clear_all', {})
  }

  const handleTest = () => {
    if (!testSentence.trim()) {
      setMessage({ type: 'error', text: 'Enter a test sentence.' })
      setTimeout(() => setMessage(null), 2000)
      return
    }
    audioEngine.playClick()
    sendWsMessage('pronunciation_test', { sentence: testSentence.trim() })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-3 py-2 mx-3 mt-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[8px] font-mono tracking-wide text-center"
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {/* Quick suggestions */}
        <div>
          <div className="text-[7px] font-mono text-white/30 tracking-wider mb-2 uppercase">💡 Quick Add Suggestions</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_WORDS.map((s) => (
              <button
                key={s.word}
                onClick={() => handleQuickAdd(s)}
                className="px-2 py-1 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-[#f59e0b]/10 hover:border-[#f59e0b]/30 transition-all cursor-pointer group"
              >
                <span className="font-mono text-[9px] text-white/70 group-hover:text-[#f59e0b]">{s.word}</span>
                <span className="text-[6px] font-mono text-white/20 ml-1">{s.pronunciation}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Add form */}
        <div className="p-3 rounded-lg bg-[#f59e0b]/8 border border-[#f59e0b]/20">
          <div className="text-[7px] font-mono text-[#f59e0b]/60 tracking-wider mb-2 uppercase">✏️ New Pronunciation</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Word (e.g. ASTRYX)"
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-mono text-white focus:outline-none focus:border-[#f59e0b]/40 placeholder-white/20 tracking-wider"
            />
            <input
              type="text"
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              placeholder={ptype === 'alias' ? 'How to say it (e.g. As-tricks)' : 'IPA (e.g. ˈdʒɑːr.vɪs)'}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-mono text-white focus:outline-none focus:border-[#f59e0b]/40 placeholder-white/20 tracking-wider"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ptype}
              onChange={(e) => setPtype(e.target.value as 'alias' | 'phoneme')}
              className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[8px] font-mono text-white/80 focus:outline-none cursor-pointer"
            >
              <option value="alias">🔤 Alias (substitution)</option>
              <option value="phoneme">🔊 IPA Phoneme</option>
            </select>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[8px] font-mono text-white/80 focus:outline-none cursor-pointer"
            >
              <option value="en">🇬🇧 English</option>
              <option value="ml">🇮🇳 Malayalam</option>
              <option value="hi">🇮🇳 Hindi</option>
              <option value="ta">🇮🇳 Tamil</option>
            </select>
            <button
              onClick={handleAdd}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#f59e0b]/20 border border-[#f59e0b]/40 text-[#f59e0b] font-mono text-[8px] tracking-widest uppercase hover:bg-[#f59e0b]/30 transition-all cursor-pointer"
            >
              💾 Save
            </button>
          </div>
        </div>

        {/* Test area */}
        <div className="p-3 rounded-lg bg-[#06b6d4]/8 border border-[#06b6d4]/20">
          <div className="text-[7px] font-mono text-[#06b6d4]/60 tracking-wider mb-2 uppercase">🎯 Test Pronunciation</div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={testSentence}
              onChange={(e) => setTestSentence(e.target.value)}
              placeholder="Enter a sentence to test..."
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-mono text-white focus:outline-none focus:border-[#06b6d4]/40 placeholder-white/20 tracking-wider"
            />
            <button
              onClick={handleTest}
              className="px-3 py-1.5 rounded-lg bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4] font-mono text-[8px] tracking-widest uppercase hover:bg-[#06b6d4]/30 transition-all cursor-pointer"
            >
              Test
            </button>
          </div>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="p-2 rounded bg-white/5">
                <div className="text-[6px] font-mono text-white/30 tracking-wider uppercase mb-0.5">Original:</div>
                <div className="font-mono text-[8px] text-white/70">{testResult.original}</div>
              </div>
              {testResult.has_ssml ? (
                <>
                  <div className="p-2 rounded bg-[#06b6d4]/10 border border-[#06b6d4]/20">
                    <div className="text-[6px] font-mono text-[#06b6d4]/60 tracking-wider uppercase mb-0.5">✅ SSML Output:</div>
                    <div className="font-mono text-[7px] text-[#06b6d4] break-all">{testResult.ssml}</div>
                  </div>
                  {testResult.matched_entries.length > 0 && (
                    <div className="text-[7px] font-mono text-[#22c55e]/70">
                      Matched {testResult.matched_entries.length} pronunciation{testResult.matched_entries.length > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[7px] font-mono text-white/30">No pronunciations matched this sentence.</div>
              )}
            </motion.div>
          )}
        </div>

        {/* Entry list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[7px] font-mono text-white/30 tracking-wider uppercase">
              Saved Pronunciations ({pronunciations.length})
            </div>
            {pronunciations.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[6px] font-mono text-red-400/60 tracking-widest uppercase hover:text-red-400 transition-all cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {pronunciations.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-white/30">
              <span className="text-[16px] mb-1">📝</span>
              <span className="font-mono text-[7px] tracking-wider">No custom pronunciations yet</span>
              <span className="font-mono text-[6px] text-white/20 mt-1">Add one above or click a suggestion</span>
            </div>
          ) : (
            <div className="space-y-1">
              {pronunciations.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all group"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] border shrink-0 ${
                    entry.type === 'phoneme'
                      ? 'border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#a78bfa]'
                      : 'border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]'
                  }`}>
                    {entry.type === 'phoneme' ? '🔊' : '🔤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] text-white font-bold">{entry.word}</span>
                      <span className="text-[6px] text-white/20">→</span>
                      <span className="font-mono text-[8px] text-[#f59e0b] tracking-wide">{entry.pronunciation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[6px] font-mono text-white/20">
                      <span>{entry.type}</span>
                      <span>•</span>
                      <span>Used {entry.usage_count}x</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full border border-red-500/30 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer text-[6px]"
                  >
                    ✕
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
