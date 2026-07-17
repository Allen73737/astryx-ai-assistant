import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'
import type { LearningCorrection } from '@/stores/jarvis.store'

// ─── CSV Parsing (client-side preview) ──────────────────────────

type CsvRow = {
  line: number
  misheard: string
  correct: string
  language: string
  will_update: boolean
}

function parseCSVLine(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
}

function previewCSVClient(csvText: string, defaultLang: string): { rows: CsvRow[]; errors: string[]; headerSkipped: boolean } {
  const rows: CsvRow[] = []
  const errors: string[] = []
  let headerSkipped = false
  const lines = csvText.trim().split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (i === 0) {
      const firstCol = line.split(',')[0].trim().toLowerCase()
      if (['misheard', 'mis', 'word', 'phrase', 'original'].includes(firstCol)) {
        headerSkipped = true
        continue
      }
    }

    const parts = parseCSVLine(line)
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: insufficient columns`)
      continue
    }

    const misheard = parts[0].trim()
    const correct = parts[1].trim()
    const language = (parts[2] || defaultLang).trim()

    if (!misheard || !correct) {
      errors.push(`Line ${i + 1}: empty field`)
      continue
    }

    rows.push({ line: i + 1, misheard, correct, language, will_update: false })
  }

  return { rows, errors, headerSkipped }
}

interface VoiceLearningProps {
  onClose: () => void
}

type LearningStep = 'idle' | 'recording' | 'processing' | 'correcting' | 'testing' | 'review'

// Common Indian language slang/phrases the user might want to train
const SUGGESTED_PHRASES = [
  // Malayalam
  { phrase: 'എങ്ങനെയുണ്ട്?', english: 'How are you? (Malayalam)', lang: 'ml' },
  { phrase: 'എന്തുപറ്റി?', english: 'What happened? (Malayalam)', lang: 'ml' },
  { phrase: 'വേഗം വരൂ', english: 'Come fast (Malayalam)', lang: 'ml' },
  { phrase: 'എവിടെപ്പോയി?', english: 'Where did you go? (Malayalam)', lang: 'ml' },
  { phrase: 'ഇതെന്താ?', english: 'What is this? (Malayalam)', lang: 'ml' },
  // Hindi
  { phrase: 'आप कैसे हैं?', english: 'How are you? (Hindi)', lang: 'hi' },
  { phrase: 'क्या हुआ?', english: 'What happened? (Hindi)', lang: 'hi' },
  { phrase: 'जल्दी आओ', english: 'Come fast (Hindi)', lang: 'hi' },
  { phrase: 'यह क्या है?', english: 'What is this? (Hindi)', lang: 'hi' },
  { phrase: 'मैं आ रहा हूँ', english: 'I am coming (Hindi)', lang: 'hi' },
  { phrase: 'क्या बात है?', english: "What's up? (Hindi)", lang: 'hi' },
  { phrase: 'बहुत अच्छा', english: 'Very good (Hindi)', lang: 'hi' },
  { phrase: 'मुझे समझ नहीं आया', english: "I didn't understand (Hindi)", lang: 'hi' },
  // Tamil
  { phrase: 'எப்படி இருக்கீங்க?', english: 'How are you? (Tamil)', lang: 'ta' },
  { phrase: 'என்ன ஆச்சு?', english: 'What happened? (Tamil)', lang: 'ta' },
  { phrase: 'சீக்கிரம் வாங்க', english: 'Come fast (Tamil)', lang: 'ta' },
  { phrase: 'இது என்ன?', english: 'What is this? (Tamil)', lang: 'ta' },
  { phrase: 'நான் வர்றேன்', english: 'I am coming (Tamil)', lang: 'ta' },
  { phrase: 'என்ன விஷயம்?', english: "What's the matter? (Tamil)", lang: 'ta' },
  { phrase: 'ரொம்ப நல்லா இருக்கு', english: 'Very good (Tamil)', lang: 'ta' },
  { phrase: 'எனக்கு புரியலை', english: "I didn't understand (Tamil)", lang: 'ta' },
]

// Recording state type
interface RecordingState {
  mediaRecorder: MediaRecorder | null
  chunks: Blob[]
  stream: MediaStream | null
}

export function VoiceLearning({ onClose }: VoiceLearningProps): React.JSX.Element {
  const ws = useJarvisStore((s) => s.ws)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const learningModeActive = useJarvisStore((s) => s.learningModeActive)
  const setLearningModeActive = useJarvisStore((s) => s.setLearningModeActive)
  const learningCorrections = useJarvisStore((s) => s.learningCorrections)
  const setLearningCorrections = useJarvisStore((s) => s.setLearningCorrections)
  const lastTestResult = useJarvisStore((s) => s.learningLastTestResult)
  const setLastTestResult = useJarvisStore((s) => s.setLearningLastTestResult)

  const [step, setStep] = useState<LearningStep>('idle')
  const [recordingState, setRecordingState] = useState<RecordingState>({
    mediaRecorder: null,
    chunks: [],
    stream: null,
  })
  const [activeTab, setActiveTab] = useState<'train' | 'review'>('train')
  const [correctionMisheard, setCorrectionMisheard] = useState('')
  const [correctionCorrect, setCorrectionCorrect] = useState('')
  const [correctionLang, setCorrectionLang] = useState('ml')
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingVolume, setRecordingVolume] = useState(0)
  const [testRaw, setTestRaw] = useState('')
  const [testCorrected, setTestCorrected] = useState('')
  const [testMatchFound, setTestMatchFound] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Batch import state ──
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvDefaultLang, setCsvDefaultLang] = useState('ml')
  const [csvPreview, setCsvPreview] = useState<{ rows: CsvRow[]; errors: string[]; headerSkipped: boolean } | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvImportResult, setCsvImportResult] = useState<{
    imported: number
    updated: number
    skipped: number
    errors: number
    total: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const waveformPhaseRef = useRef(0)

  // Fetch corrections on mount
  const fetchCorrections = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    sendWsMessage('learning_get_corrections', {})
  }, [ws, sendWsMessage])

  useEffect(() => {
    fetchCorrections()
  }, [fetchCorrections])

  // Listen for WebSocket messages
  useEffect(() => {
    if (!ws) return
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        const p = msg.payload || {}

        if (msg.type === 'learning_corrections_list') {
          setLearningCorrections(p.corrections || [])
        } else if (msg.type === 'learning_correction_added') {
          fetchCorrections()
          setStep('idle')
          setMessage({ type: 'success', text: '✅ Correction saved! Whisper will now recognize this.' })
          setTimeout(() => setMessage(null), 3000)
        } else if (msg.type === 'learning_correction_deleted') {
          fetchCorrections()
        } else if (msg.type === 'learning_test_result') {
          setTestRaw(p.raw || '')
          setTestCorrected(p.corrected || '')
          setTestMatchFound(p.match_found || false)
          setLoading(false)
          // Only transition to idle if we were NOT already in correcting mode
          // This prevents the correction form from disappearing before user submits/skips
          setStep((current) => current === 'correcting' ? 'correcting' : 'idle')
        } else if (msg.type === 'learning_cleared') {
          setLearningCorrections([])
          setMessage({ type: 'success', text: '🗑️ All corrections cleared.' })
          setTimeout(() => setMessage(null), 3000)
        } else if (msg.type === 'learning_mode_status') {
          // Confirmation received
        } else if (msg.type === 'learning_csv_preview') {
          setCsvPreview({
            rows: (p.rows || []).map((r: any) => ({
              line: r.line,
              misheard: r.misheard,
              correct: r.correct,
              language: r.language,
              will_update: r.will_update || false,
            })),
            errors: p.errors || [],
            headerSkipped: p.header_skipped || false,
          })
        } else if (msg.type === 'learning_batch_imported') {
          setCsvImporting(false)
          setCsvImportResult({
            imported: p.imported || 0,
            updated: p.updated || 0,
            skipped: p.skipped || 0,
            errors: p.errors || 0,
            total: p.total || 0,
          })
          fetchCorrections()
          if (p.total > 0) {
            audioEngine.playSuccess()
            setMessage({ type: 'success', text: `✅ Imported ${p.total} correction${p.total !== 1 ? 's' : ''}!` })
            setTimeout(() => setMessage(null), 3000)
          }
        }
      } catch { /* ignore */ }
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [ws, fetchCorrections, setLearningCorrections])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [])

  // ─── Recording ─────────────────────────────────────────────

  const startRecording = async () => {
    try {
      audioEngine.playClick()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Set up volume analysis
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioContextRef.current = audioCtx
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        processRecording(blob)
        // Cleanup stream
        stream.getTracks().forEach(t => t.stop())
        if (audioCtx.state !== 'closed') audioCtx.close()
      }

      mediaRecorder.start()
      setRecordingState({ mediaRecorder, chunks, stream })
      setRecordingDuration(0)
      setStep('recording')

      // Volume monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const volInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setRecordingVolume(Math.min(avg / 128, 1))
        waveformPhaseRef.current += 1
      }, 50)

      // Duration counter
      let secs = 0
      recordingTimerRef.current = setInterval(() => {
        secs++
        setRecordingDuration(secs)
        if (secs >= 10) stopRecording() // Auto-stop at 10 seconds
      }, 1000)

      return () => {
        clearInterval(volInterval)
      }
    } catch (err) {
      setMessage({ type: 'error', text: '❌ Microphone access denied. Please allow microphone permissions.' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const stopRecording = () => {
    const { mediaRecorder, stream } = recordingState
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const processRecording = async (blob: Blob) => {
    setStep('processing')
    audioEngine.playElevate()

    // Convert blob to base64
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onloadend = () => {
      const base64data = reader.result as string
      const base64 = base64data.split(',')[1]

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setMessage({ type: 'error', text: '❌ Backend not connected.' })
        setTimeout(() => setMessage(null), 3000)
        setStep('idle')
        return
      }

      // Transcribe to see what Whisper hears
      sendWsMessage('learning_test_phrase', {
        audio: base64,
        sampleRate: 16000,
      })

      setStep('correcting')
      setLoading(true)
    }
  }

  // ─── Correction Submission ──────────────────────────────────

  const submitCorrection = () => {
    if (!correctionMisheard.trim() || !correctionCorrect.trim()) {
      setMessage({ type: 'error', text: 'Please fill in both the heard and correct text.' })
      setTimeout(() => setMessage(null), 3000)
      return
    }
    audioEngine.playSuccess()

    // Re-send the audio with the correction
    sendWsMessage('learning_add_correction', {
      misheard: correctionMisheard.trim(),
      correct: correctionCorrect.trim(),
      language: correctionLang,
    })
    setCorrectionMisheard('')
    setCorrectionCorrect('')
  }

  const skipCorrection = () => {
    audioEngine.playClick()
    setCorrectionMisheard('')
    setCorrectionCorrect('')
    setStep('idle')
  }

  // ─── Test ───────────────────────────────────────────────────

  const startTest = async () => {
    if (learningCorrections.length === 0) {
      setMessage({ type: 'error', text: 'No corrections saved yet. Train some phrases first!' })
      setTimeout(() => setMessage(null), 3000)
      return
    }
    audioEngine.playClick()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          if (ws?.readyState === WebSocket.OPEN) {
            setLoading(true)
            setStep('testing')
            sendWsMessage('learning_test_phrase', { audio: base64, sampleRate: 16000 })
          }
        }
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start()
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
      }, 3000)
    } catch (err) {
      setMessage({ type: 'error', text: '❌ Microphone access denied.' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // ─── Toggle Learning Mode ──────────────────────────────────

  const toggleLearningMode = () => {
    audioEngine.playClick()
    const newState = !learningModeActive
    setLearningModeActive(newState)
    sendWsMessage('learning_mode', { active: newState })
  }

  // ─── Clear All ──────────────────────────────────────────────

  const handleClearAll = () => {
    if (learningCorrections.length === 0) return
    audioEngine.playClick()
    sendWsMessage('learning_clear_all', {})
  }

  // ─── Delete Single ─────────────────────────────────────────

  const handleDelete = (id: string) => {
    audioEngine.playClick()
    sendWsMessage('learning_delete_correction', { id })
  }

  // ─── Use Result as Correction ──────────────────────────────

  const useResultAsCorrection = () => {
    setCorrectionMisheard(testRaw)
    setCorrectionCorrect('')
    setStep('correcting')
    setLoading(false)
    setSelectedSuggestion(null)
  }

  const suggestCorrection = () => {
    if (testCorrected && testCorrected !== testRaw) {
      setCorrectionMisheard(testRaw)
      setCorrectionCorrect(testCorrected)
    }
  }

  // ─── Batch Import ─────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    audioEngine.playClick()

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setCsvText(text)
      // Client-side preview
      const preview = previewCSVClient(text, csvDefaultLang)
      setCsvPreview(preview)
      setCsvImportResult(null)

      // Also send to backend for server-side preview
      if (ws?.readyState === WebSocket.OPEN) {
        sendWsMessage('learning_preview_csv', { csv: text, default_language: csvDefaultLang })
      }
    }
    reader.readAsText(file)

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCsvImport = () => {
    if (!csvText.trim() || !ws || ws.readyState !== WebSocket.OPEN) return
    audioEngine.playElevate()
    setCsvImporting(true)
    sendWsMessage('learning_batch_import', {
      csv: csvText,
      default_language: csvDefaultLang,
    })
  }

  const handleCsvClear = () => {
    audioEngine.playClick()
    setCsvText('')
    setCsvPreview(null)
    setCsvImportResult(null)
    setCsvImporting(false)
  }

  const downloadSampleCsv = () => {
    audioEngine.playClick()
    const sample = `misheard,correct,language
angane und,എങ്ങനെയുണ്ട്?,ml
entu prati,എന്തുപറ്റി?,ml
ap kaise hain,आप कैसे हैं?,hi
eppadi irukinga,எப்படி இருக்கீங்க?,ta`
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'voice_corrections_sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full border border-[#a78bfa]/40 flex items-center justify-center">
            <span className="text-[12px]">🧠</span>
          </div>
          <div>
            <h3 className="font-display text-[11px] text-white tracking-[0.2em] font-bold uppercase">Voice Learning</h3>
            <p className="font-mono text-[7px] text-[#a78bfa]/60 tracking-wider">ACCENT ADAPTATION • {learningCorrections.length} CORRECTIONS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Learning Mode Toggle */}
          <button
            onClick={toggleLearningMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[7px] font-mono tracking-widest uppercase transition-all cursor-pointer border ${
              learningModeActive
                ? 'bg-[#a78bfa]/20 border-[#a78bfa]/50 text-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.2)]'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${learningModeActive ? 'bg-[#a78bfa] animate-pulse' : 'bg-white/20'}`} />
            {learningModeActive ? 'Learning ON' : 'Learning OFF'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 shrink-0">
        <button
          onClick={() => { audioEngine.playClick(); setActiveTab('train'); setStep('idle') }}
          className={`flex-1 py-2 text-[8px] font-mono tracking-widest uppercase transition-all cursor-pointer ${
            activeTab === 'train'
              ? 'text-[#a78bfa] border-b-2 border-[#a78bfa] bg-[#a78bfa]/5'
              : 'text-white/30 hover:text-white/50 border-b-2 border-transparent'
          }`}
        >
          🎯 Train
        </button>
        <button
          onClick={() => { audioEngine.playClick(); fetchCorrections(); setActiveTab('review') }}
          className={`flex-1 py-2 text-[8px] font-mono tracking-widest uppercase transition-all cursor-pointer ${
            activeTab === 'review'
              ? 'text-[#a78bfa] border-b-2 border-[#a78bfa] bg-[#a78bfa]/5'
              : 'text-white/30 hover:text-white/50 border-b-2 border-transparent'
          }`}
        >
          📖 Review ({learningCorrections.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {activeTab === 'train' && (
          <div className="space-y-4">
            {/* Status Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-3 py-2 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-[8px] font-mono tracking-wide text-center"
                >
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step: Recording */}
            {step === 'recording' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-6 space-y-3"
              >        {/* Animated waveform — driven purely by recordingVolume state, no Date.now() in render */}
                  <div className="flex items-center gap-[3px] h-12">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: `${Math.max(4, recordingVolume * 40 * (0.5 + Math.sin(i * 0.5 + waveformPhaseRef.current * 0.1) * 0.5))}px`,
                        }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="w-[3px] rounded-full bg-gradient-to-t from-[#a78bfa] to-[#c084fc]"
                      />
                    ))}
                  </div>
                <div className="font-mono text-[10px] text-[#a78bfa] tracking-widest animate-pulse">
                  🎤 RECORDING... {recordingDuration}s
                </div>
                <div className="text-[7px] font-mono text-white/30 tracking-wider">Say the Malayalam phrase you want to train</div>
                <button
                  onClick={stopRecording}
                  className="px-6 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[8px] tracking-widest uppercase hover:bg-red-500/30 transition-all cursor-pointer"
                >
                  ⏹ Stop Recording
                </button>
              </motion.div>
            )}

            {/* Step: Processing */}
            {step === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-6 space-y-3"
              >
                <div className="w-8 h-8 border-t-2 border-[#a78bfa] rounded-full animate-spin" />
                <div className="font-mono text-[9px] text-[#a78bfa]/70 tracking-widest uppercase animate-pulse">
                  Transcribing with Whisper...
                </div>
              </motion.div>
            )}

            {/* Step: Correcting */}
            {step === 'correcting' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {loading ? (
                  <div className="flex flex-col items-center py-4 space-y-2">
                    <div className="w-6 h-6 border-t-2 border-[#a78bfa] rounded-full animate-spin" />
                    <div className="font-mono text-[8px] text-[#a78bfa]/60 tracking-widest uppercase">Processing...</div>
                  </div>
                ) : (
                  <>
                    {/* Whisper heard */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-[7px] font-mono text-white/40 tracking-wider mb-1 uppercase">🤖 What Whisper heard:</div>
                      <div className="font-mono text-[10px] text-[#f59e0b] tracking-wide">{testRaw || '(no speech detected)'}</div>
                    </div>

                    {/* Corrected result (if learning already applied) */}
                    {testMatchFound && testCorrected && (
                      <div className="p-3 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/30">
                        <div className="text-[7px] font-mono text-[#a78bfa]/60 tracking-wider mb-1 uppercase">✨ Learning Corrected To:</div>
                        <div className="font-mono text-[10px] text-[#a78bfa] tracking-wide">{testCorrected}</div>
                        <div className="text-[7px] font-mono text-[#a78bfa]/40 mt-1 tracking-wider">This correction is already active.</div>
                      </div>
                    )}

                    {/* Correction input */}
                    <div className="p-3 rounded-lg bg-[#a78bfa]/8 border border-[#a78bfa]/20">
                      <div className="text-[7px] font-mono text-[#a78bfa]/60 tracking-wider mb-2 uppercase">✏️ Enter correct transcription:</div>
                      <input
                        type="text"
                        value={correctionMisheard}
                        onChange={(e) => setCorrectionMisheard(e.target.value)}
                        placeholder="What Whisper heard (auto-filled)"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 mb-2 text-[9px] font-mono text-[#f59e0b] focus:outline-none focus:border-[#a78bfa]/40 placeholder-white/20 tracking-wider"
                      />
                      <input
                        type="text"
                        value={correctionCorrect}
                        onChange={(e) => setCorrectionCorrect(e.target.value)}
                        placeholder="What you actually said (Malayalam script)"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 mb-2 text-[9px] font-mono text-white focus:outline-none focus:border-[#a78bfa]/40 placeholder-white/20 tracking-wider"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={correctionLang}
                          onChange={(e) => setCorrectionLang(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[8px] font-mono text-white/80 focus:outline-none cursor-pointer"
                        >
                          <option value="ml">🇮🇳 Malayalam</option>
                          <option value="hi">🇮🇳 Hindi</option>
                          <option value="ta">🇮🇳 Tamil</option>
                          <option value="en">🇬🇧 English</option>
                        </select>
                        <button
                          onClick={submitCorrection}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-[#a78bfa]/20 border border-[#a78bfa]/40 text-[#a78bfa] font-mono text-[8px] tracking-widest uppercase hover:bg-[#a78bfa]/30 transition-all cursor-pointer"
                        >
                          💾 Save Correction
                        </button>
                        <button
                          onClick={skipCorrection}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 font-mono text-[8px] tracking-widest uppercase hover:text-white/70 transition-all cursor-pointer"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step: Testing */}
            {step === 'testing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-6 space-y-3"
              >
                <div className="w-8 h-8 border-t-2 border-[#a78bfa] rounded-full animate-spin" />
                <div className="font-mono text-[9px] text-[#a78bfa]/70 tracking-widest uppercase">
                  Testing transcription...
                </div>
              </motion.div>
            )}

            {/* Idle State: Actions */}
            {step === 'idle' && (
              <div className="space-y-4">
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startRecording}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/30 hover:bg-[#a78bfa]/20 transition-all cursor-pointer group"
                  >
                    <span className="text-[18px] group-hover:scale-110 transition-transform">🎤</span>
                    <span className="font-mono text-[8px] text-[#a78bfa] tracking-widest uppercase font-bold">Record Phrase</span>
                    <span className="text-[6px] font-mono text-white/30 tracking-wider text-center">Say a Malayalam phrase to train Whisper to understand your accent</span>
                  </button>

                  <button
                    onClick={startTest}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#06b6d4]/10 border border-[#06b6d4]/30 hover:bg-[#06b6d4]/20 transition-all cursor-pointer group"
                  >
                    <span className="text-[18px] group-hover:scale-110 transition-transform">🎯</span>
                    <span className="font-mono text-[8px] text-[#06b6d4] tracking-widest uppercase font-bold">Test & Verify</span>
                    <span className="text-[6px] font-mono text-white/30 tracking-wider text-center">Speak a phrase and see if Whisper understands it correctly now</span>
                  </button>
                </div>

                {/* Test results display */}
                <AnimatePresence>
                  {testRaw && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-2"
                    >
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[7px] font-mono text-white/40 tracking-wider mb-1 uppercase">🤖 Raw Whisper Output:</div>
                        <div className="font-mono text-[10px] text-[#f59e0b] tracking-wide">{testRaw}</div>
                      </div>
                      {testMatchFound && (
                        <div className="p-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30">
                          <div className="text-[7px] font-mono text-[#22c55e]/60 tracking-wider mb-1 uppercase">✅ Corrected by Learning:</div>
                          <div className="font-mono text-[10px] text-[#22c55e] tracking-wide">{testCorrected}</div>
                        </div>
                      )}
                      {!testMatchFound && testRaw && (
                        <div className="flex gap-2">
                          <button
                            onClick={useResultAsCorrection}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-[#a78bfa]/20 border border-[#a78bfa]/40 text-[#a78bfa] font-mono text-[7px] tracking-widest uppercase hover:bg-[#a78bfa]/30 transition-all cursor-pointer"
                          >
                            ✏️ Correct This
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Batch Import Section */}
                <div>
                  <button
                    onClick={() => { audioEngine.playClick(); setShowBatchImport(!showBatchImport); setCsvImportResult(null) }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-[#06b6d4]/10 hover:border-[#06b6d4]/30 transition-all cursor-pointer group mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[12px]">📦</span>
                      <span className="font-mono text-[8px] text-white/70 tracking-wider uppercase font-bold group-hover:text-[#06b6d4]">
                        Batch Import (CSV)
                      </span>
                    </div>
                    <span className={`text-[8px] text-white/30 transition-transform ${showBatchImport ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {showBatchImport && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pb-3"
                    >
                      {/* File upload + text area + preview */}
                      <div className="p-3 rounded-lg border border-dashed border-[#06b6d4]/30 bg-[#06b6d4]/5 space-y-2">
                        {/* Toolbar */}
                        <div className="flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4] font-mono text-[8px] tracking-widest uppercase hover:bg-[#06b6d4]/30 transition-all cursor-pointer"
                          >
                            📂 Choose File
                          </button>
                          <button
                            onClick={downloadSampleCsv}
                            className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 font-mono text-[7px] tracking-wider uppercase hover:text-white/70 transition-all cursor-pointer"
                          >
                            📥 Sample
                          </button>
                          {csvText && (
                            <button
                              onClick={handleCsvClear}
                              className="px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/70 font-mono text-[7px] tracking-wider uppercase hover:text-red-400 transition-all cursor-pointer"
                            >
                              ✕ Clear
                            </button>
                          )}
                          {/* Default language selector */}
                          <select
                            value={csvDefaultLang}
                            onChange={(e) => { setCsvDefaultLang(e.target.value); if (csvText) {
                              const preview = previewCSVClient(csvText, e.target.value)
                              setCsvPreview(preview)
                              if (ws?.readyState === WebSocket.OPEN) {
                                sendWsMessage('learning_preview_csv', { csv: csvText, default_language: e.target.value })
                              }
                            }}}
                            className="ml-auto bg-black/40 border border-white/10 rounded px-2 py-1 text-[7px] font-mono text-white/80 focus:outline-none cursor-pointer"
                          >
                            <option value="ml">🇮🇳 ML</option>
                            <option value="hi">🇮🇳 HI</option>
                            <option value="ta">🇮🇳 TA</option>
                            <option value="en">🇬🇧 EN</option>
                          </select>
                        </div>

                        {/* CSV text area — always visible for editing */}
                        <textarea
                          value={csvText}
                          onChange={(e) => {
                            const text = e.target.value
                            setCsvText(text)
                            if (text.trim()) {
                              const preview = previewCSVClient(text, csvDefaultLang)
                              setCsvPreview(preview)
                              if (ws?.readyState === WebSocket.OPEN) {
                                sendWsMessage('learning_preview_csv', { csv: text, default_language: csvDefaultLang })
                              }
                            } else {
                              setCsvPreview(null)
                              setCsvImportResult(null)
                            }
                          }}
                          placeholder={'misheard,correct,language\nangane und,എങ്ങനെയുണ്ട്?,ml\nap kaise hain,आप कैसे हैं?,hi\neppadi irukinga,எப்படி இருக்கீங்க?,ta'}
                          rows={3}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[8px] font-mono text-white/70 focus:outline-none focus:border-[#06b6d4]/40 placeholder-white/15 tracking-wider resize-none"
                        />

                        {/* CSV preview table */}
                        {csvPreview && csvPreview.rows.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[7px] font-mono text-[#06b6d4]/60 tracking-wider">
                                📋 Preview: {csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''} detected
                                {csvPreview.headerSkipped ? ' (header skipped)' : ''}
                              </span>
                            </div>
                            <div className="max-h-[150px] overflow-y-auto border border-white/5 rounded-lg">
                              <table className="w-full text-[7px] font-mono">
                                <thead className="bg-white/5 sticky top-0">
                                  <tr>
                                    <th className="px-2 py-1 text-left text-white/40 tracking-wider uppercase">Misheard</th>
                                    <th className="px-2 py-1 text-left text-white/40 tracking-wider uppercase">Correct</th>
                                    <th className="px-2 py-1 text-left text-white/40 tracking-wider uppercase">Lang</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {csvPreview.rows.slice(0, 20).map((row, idx) => (
                                    <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.02]">
                                      <td className="px-2 py-1 text-[#f59e0b]/80">{row.misheard}</td>
                                      <td className="px-2 py-1 text-[#22c55e]">{row.correct}</td>
                                      <td className="px-2 py-1 text-white/40">{row.language}</td>
                                    </tr>
                                  ))}
                                  {csvPreview.rows.length > 20 && (
                                    <tr className="border-t border-white/5">
                                      <td colSpan={3} className="px-2 py-1 text-white/30 text-center">
                                        ... and {csvPreview.rows.length - 20} more
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Errors */}
                        {csvPreview && csvPreview.errors.length > 0 && (
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                            <div className="text-[6px] font-mono text-red-400/70 tracking-wider uppercase mb-1">⚠️ {csvPreview.errors.length} error{csvPreview.errors.length !== 1 ? 's' : ''}:</div>
                            {csvPreview.errors.slice(0, 5).map((err, i) => (
                              <div key={i} className="text-[7px] font-mono text-red-400/60">{err}</div>
                            ))}
                          </div>
                        )}

                        {/* Import result */}
                        {csvImportResult && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30"
                          >
                            <div className="text-[7px] font-mono text-[#22c55e]/80 tracking-wider">
                              ✅ Import complete: {csvImportResult.imported} new, {csvImportResult.updated} updated
                              {csvImportResult.errors > 0 && `, ${csvImportResult.errors} error${csvImportResult.errors !== 1 ? 's' : ''}`}
                            </div>
                          </motion.div>
                        )}

                        {/* Import button — disabled when no rows or already imported */}
                        {(!csvImportResult) && (
                          <button
                            onClick={handleCsvImport}
                            disabled={csvImporting || !csvPreview || csvPreview.rows.length === 0}
                            className="w-full py-2 rounded-lg bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4] font-mono text-[8px] tracking-widest uppercase hover:bg-[#06b6d4]/30 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {csvImporting ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="w-3 h-3 border-t border-[#06b6d4] rounded-full animate-spin" />
                                IMPORTING...
                              </span>
                            ) : !csvText.trim() ? (
                              '📥 Paste or upload CSV above'
                            ) : (
                              `📥 Import ${csvPreview?.rows.length || 0} Correction${csvPreview?.rows.length !== 1 ? 's' : ''}`
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Suggested phrases */}
                <div>
                  <div className="text-[7px] font-mono text-white/30 tracking-wider mb-2 uppercase">💡 Suggested Malayalam Phrases to Train</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_PHRASES.map((item) => (
                      <button
                        key={item.phrase}
                        onClick={() => {
                          audioEngine.playClick()
                          setSelectedSuggestion(item.phrase)
                          setCorrectionLang(item.lang)
                          startRecording()
                        }}
                        className="px-2 py-1 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-[#a78bfa]/10 hover:border-[#a78bfa]/30 transition-all cursor-pointer group"
                        title={item.english}
                      >
                        <span className="font-mono text-[9px] text-white/70 group-hover:text-[#a78bfa]">{item.phrase}</span>
                        <span className="text-[6px] font-mono text-white/20 ml-1">{item.english}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tutorial hint */}
            {learningCorrections.length === 0 && step === 'idle' && !testRaw && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-[#a78bfa]/5 to-transparent border border-[#a78bfa]/10">
                <div className="font-mono text-[8px] text-[#a78bfa]/60 tracking-wider leading-relaxed">
                  <span className="text-[#a78bfa] font-bold">How it works:</span><br />
                  1. Click <span className="text-white/80">Record Phrase</span> and speak a Malayalam phrase<br />
                  2. Whisper transcribes it — you'll see what it heard<br />
                  3. If incorrect, type the correct Malayalam text and save it<br />
                  4. Future transcriptions will be <span className="text-[#a78bfa]">automatically corrected</span><br />
                  5. Use <span className="text-white/80">Test & Verify</span> to check if it's working
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div className="space-y-3">
            {/* Stats */}
            {learningCorrections.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-center">
                  <div className="text-[14px] font-mono text-[#a78bfa] font-bold">{learningCorrections.length}</div>
                  <div className="text-[6px] font-mono text-white/40 tracking-wider uppercase">Saved</div>
                </div>
                <div className="p-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 text-center">
                  <div className="text-[14px] font-mono text-[#22c55e] font-bold">
                    {learningCorrections.reduce((sum, c) => sum + (c.usage_count || 0), 0)}
                  </div>
                  <div className="text-[6px] font-mono text-white/40 tracking-wider uppercase">Times Used</div>
                </div>
                <div className="p-2 rounded-lg bg-[#06b6d4]/10 border border-[#06b6d4]/20 text-center">
                  <div className="text-[14px] font-mono text-[#06b6d4] font-bold">
                    {learningCorrections.filter(c => c.language === 'ml').length}
                  </div>
                  <div className="text-[6px] font-mono text-white/40 tracking-wider uppercase">Malayalam</div>
                </div>
              </div>
            )}

            {/* Correction list */}
            {learningCorrections.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-white/30">
                <span className="text-2xl mb-2">📭</span>
                <span className="font-mono text-[8px] tracking-wider">No corrections yet</span>
                <span className="font-mono text-[7px] text-white/20 mt-1">Go to the Train tab to add some</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {learningCorrections.map((correction) => (
                  <motion.div
                    key={correction.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[7px]">{correction.language === 'ml' ? '🇮🇳' : '🌐'}</span>
                        <span className="font-mono text-[8px] text-[#f59e0b]/80 line-through tracking-wide">{correction.misheard}</span>
                        <span className="text-[6px] text-white/20">→</span>
                        <span className="font-mono text-[8px] text-[#22c55e] font-bold tracking-wide">{correction.correct}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[6px] font-mono text-white/20">
                          Used {correction.usage_count || 0}x
                        </span>
                        {correction.created_at && (
                          <span className="text-[6px] font-mono text-white/10">
                            • {new Date(correction.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(correction.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full border border-red-500/30 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer text-[7px]"
                      title="Delete correction"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Clear all */}
            {learningCorrections.length > 0 && (
              <button
                onClick={handleClearAll}
                className="w-full py-2 rounded-lg border border-red-500/20 text-red-400/60 font-mono text-[7px] tracking-widest uppercase hover:border-red-500/40 hover:text-red-400 transition-all cursor-pointer"
              >
                🗑️ Clear All Corrections
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
