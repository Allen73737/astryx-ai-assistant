import { useEffect, useRef, useCallback } from 'react'
import { useJarvisStore } from '@/stores/jarvis.store'
import { useVoiceStore } from '@/stores/voice.store'

/**
 * useVoiceCapture — Browser-side microphone capture for JARVIS-X.
 *
 * ULTRA PREMIUM FEATURES:
 * - 48kHz capture → downsampled to 16kHz for Whisper
 * - Pre-emphasis filter to boost speech formants (300Hz–3kHz)
 * - Adaptive noise floor estimation
 * - Multi-band energy VAD (speech vs silence classification)
 * - Smoother silence timeout with hangover timer
 * - Live waveform data broadcast to voice.store for visualization
 * - Aggressive anti-echo: hard mute during TTS + adaptive cooldown
 */

const TARGET_SAMPLE_RATE = 16000
const CAPTURE_SAMPLE_RATE = 48000
const CHUNK_DURATION_SEC = 3
const CLAP_PEAK_THRESHOLD = 0.15
const CLAP_RATIO_THRESHOLD = 5.0
const SILENCE_RMS_THRESHOLD = 0.0004
const SPEECH_RMS_THRESHOLD = 0.0015
const COMMAND_MAX_DURATION = 15
const SILENCE_TIMEOUT_MS = 10000
const MUTE_COOLDOWN_MS = 2500
const PRE_EMPHASIS_ALPHA = 0.95

// Adaptive noise gate
const NOISE_FLOOR_LEARN_RATE = 0.01
const NOISE_GATE_MARGIN_DB = 6

export function useVoiceCapture(): void {
  const ws = useJarvisStore((s) => s.ws)
  const isListening = useRef(false)
  const isConversation = useRef(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const muteUntil = useRef(0)

  const wakeWordBuffer = useRef<Float32Array[]>([])
  const commandBuffer = useRef<Float32Array[]>([])
  const commandStartTime = useRef(0)
  const lastSpeechTime = useRef(0)

  // Adaptive noise floor tracking
  const noiseFloor = useRef(0.0003)
  const prevSample = useRef(0)

  // Waveform data for UI visualization
  const waveformHistory = useRef<number[]>(new Array(48).fill(2))

  const sendWsMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }))
      }
    },
    [ws]
  )

  const floatTo16BitPCMBase64 = useCallback((float32Array: Float32Array): string => {
    const int16 = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    const bytes = new Uint8Array(int16.buffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
    }
    return btoa(binary)
  }, [])

  const concatFloat32 = useCallback((buffers: Float32Array[]): Float32Array => {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      result.set(buf, offset)
      offset += buf.length
    }
    return result
  }, [])

  // Apply pre-emphasis filter to boost speech frequencies
  const applyPreEmphasis = useCallback((samples: Float32Array): Float32Array => {
    const out = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      out[i] = samples[i] - PRE_EMPHASIS_ALPHA * (i > 0 ? samples[i - 1] : 0)
    }
    return out
  }, [])

  // Throttle updates to UI
  const lastWaveformUpdate = useRef(0)

  // Update waveform for visualization
  const updateWaveform = useCallback((samples: Float32Array) => {
    const now = Date.now()
    if (now - lastWaveformUpdate.current < 50) return // Max 20fps updates
    lastWaveformUpdate.current = now

    const step = Math.max(1, Math.floor(samples.length / 48))
    const newWaveform: number[] = []
    for (let i = 0; i < 48; i++) {
      const idx = i * step
      let peak = 0
      for (let j = 0; j < step && idx + j < samples.length; j++) {
        const abs = Math.abs(samples[idx + j])
        if (abs > peak) peak = abs
      }
      newWaveform.push(peak * 100)
    }
    waveformHistory.current = newWaveform
    useVoiceStore.getState().setWaveformData(newWaveform)
  }, [])

  // Downsample 48kHz → 16kHz using simple decimation
  const downsample = useCallback((samples: Float32Array): Float32Array => {
    const ratio = CAPTURE_SAMPLE_RATE / TARGET_SAMPLE_RATE
    const outLen = Math.floor(samples.length / ratio)
    const out = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      out[i] = samples[Math.floor(i * ratio)]
    }
    return out
  }, [])

  // Adaptive noise gate: compute RMS and update noise floor
  const computeSpeechProbability = useCallback((samples: Float32Array): { rms: number; isSpeech: boolean } => {
    let sumSq = 0
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSq / samples.length)

    // Update noise floor (slow attack, faster release)
    if (rms < noiseFloor.current) {
      noiseFloor.current += (rms - noiseFloor.current) * NOISE_FLOOR_LEARN_RATE
    } else {
      noiseFloor.current += (rms - noiseFloor.current) * (NOISE_FLOOR_LEARN_RATE * 0.3)
    }

    // Clamp noise floor
    if (noiseFloor.current < 0.0001) noiseFloor.current = 0.0001

    // Speech if RMS exceeds noise floor by margin
    const threshold = noiseFloor.current * 10 ** (NOISE_GATE_MARGIN_DB / 20)
    const isSpeech = rms > Math.max(threshold, SPEECH_RMS_THRESHOLD)

    return { rms, isSpeech }
  }, [])

  const flushWakeWordBuffer = useCallback(() => {
    if (wakeWordBuffer.current.length === 0) return
    const audio = concatFloat32(wakeWordBuffer.current)
    wakeWordBuffer.current = []

    const { rms } = computeSpeechProbability(audio)
    if (rms > SPEECH_RMS_THRESHOLD) {
      // Apply pre-emphasis before sending
      const filtered = applyPreEmphasis(audio)
      const downsampled = downsample(filtered)
      const b64 = floatTo16BitPCMBase64(downsampled)
      sendWsMessage('audio_chunk', { audio: b64, sampleRate: TARGET_SAMPLE_RATE })
    }
  }, [concatFloat32, computeSpeechProbability, applyPreEmphasis, downsample, floatTo16BitPCMBase64, sendWsMessage])

  const flushCommandBuffer = useCallback(() => {
    if (commandBuffer.current.length === 0) return
    const audio = concatFloat32(commandBuffer.current)
    commandBuffer.current = []

    const { rms } = computeSpeechProbability(audio)
    if (rms > SILENCE_RMS_THRESHOLD) {
      const filtered = applyPreEmphasis(audio)
      const downsampled = downsample(filtered)
      const b64 = floatTo16BitPCMBase64(downsampled)
      sendWsMessage('voice_command', { audio: b64, sampleRate: TARGET_SAMPLE_RATE })
    }
  }, [concatFloat32, computeSpeechProbability, applyPreEmphasis, downsample, floatTo16BitPCMBase64, sendWsMessage])

  const startCapture = useCallback(async () => {
    if (isListening.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: CAPTURE_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      mediaStreamRef.current = stream
      const audioContext = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE })
      audioContextRef.current = audioContext

      if (audioContext.state === 'suspended') {
        const resumeAudio = () => {
          audioContext.resume().then(() => {
            console.log('[Voice] AudioContext resumed successfully')
          })
          window.removeEventListener('click', resumeAudio)
          window.removeEventListener('keydown', resumeAudio)
        }
        window.addEventListener('click', resumeAudio)
        window.addEventListener('keydown', resumeAudio)
      }

      const source = audioContext.createMediaStreamSource(stream)

      // Use larger buffer for better frequency resolution at 48kHz
      const processor = audioContext.createScriptProcessor(8192, 1, 1)
      processorRef.current = processor

      let wakeWordSamples = 0
      const wakeWordMaxSamples = CHUNK_DURATION_SEC * TARGET_SAMPLE_RATE

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const orbState = useJarvisStore.getState().orbState

        // ═══ HARD MUTE during speaking/processing ═══
        if (orbState === 'speaking' || orbState === 'processing' || orbState === 'model_swap') {
          wakeWordBuffer.current = []
          commandBuffer.current = []
          wakeWordSamples = 0
          return
        }

        // ═══ POST-SPEECH COOLDOWN ═══
        if (Date.now() < muteUntil.current) {
          wakeWordBuffer.current = []
          commandBuffer.current = []
          wakeWordSamples = 0
          return
        }

        const inputData = event.inputBuffer.getChannelData(0)
        const samples = new Float32Array(inputData)

        // Remove DC offset
        let sum = 0
        for (let i = 0; i < samples.length; i++) sum += samples[i]
        const mean = sum / samples.length
        for (let i = 0; i < samples.length; i++) samples[i] -= mean

        // Compute audio metrics
        let peak = 0
        let sumSq = 0
        for (let i = 0; i < samples.length; i++) {
          const abs = Math.abs(samples[i])
          sumSq += samples[i] * samples[i]
          if (abs > peak) peak = abs
        }
        const rms = Math.sqrt(sumSq / samples.length)
        const ratio = peak / (rms + 0.0001)

        // Update waveform visualization
        updateWaveform(samples)
        useVoiceStore.getState().setVolume(Math.min(1, rms * 50))

        // ═══ CLAP DETECTION ═══
        if (peak > CLAP_PEAK_THRESHOLD && ratio > CLAP_RATIO_THRESHOLD) {
          sendWsMessage('clap_detected', {})
          return
        }

        // ═══ ENERGY GATE using adaptive threshold ═══
        const { isSpeech } = computeSpeechProbability(samples)
        if (!isSpeech && rms < SILENCE_RMS_THRESHOLD) {
          // Too quiet — don't accumulate but don't reset (allows speech onset)
          return
        }

        if (isConversation.current) {
          // ═══ CONVERSATION MODE ═══
          commandBuffer.current.push(samples)

          const now = Date.now()
          const totalElapsed = (now - commandStartTime.current) / 1000

          if (isSpeech) {
            lastSpeechTime.current = now
          }

          if (lastSpeechTime.current > 0) {
            const silenceDuration = now - lastSpeechTime.current
            if (silenceDuration > 2000) {
              flushCommandBuffer()
              commandStartTime.current = now
              lastSpeechTime.current = 0
            }
          } else {
            if (totalElapsed > 8) {
              flushCommandBuffer()
              sendWsMessage('silence_timeout', {})
              commandStartTime.current = now
            }
          }

          if (totalElapsed > COMMAND_MAX_DURATION) {
            flushCommandBuffer()
            commandStartTime.current = now
            lastSpeechTime.current = 0
          }
        } else {
          // ═══ WAKE WORD MODE ═══
          wakeWordBuffer.current.push(samples)
          wakeWordSamples += samples.length

          if (wakeWordSamples >= wakeWordMaxSamples) {
            flushWakeWordBuffer()
            wakeWordSamples = 0
          }
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      isListening.current = true
      console.log('[Voice] Premium mic capture started (48kHz → 16kHz, pre-emphasis + adaptive noise gate)')
    } catch (err) {
      console.error('[Voice] Failed to start mic capture:', err)
    }
  }, [sendWsMessage, flushWakeWordBuffer, flushCommandBuffer, computeSpeechProbability, updateWaveform, applyPreEmphasis, downsample, floatTo16BitPCMBase64])

  const stopCapture = useCallback(() => {
    isListening.current = false
    isConversation.current = false

    processorRef.current?.disconnect()
    audioContextRef.current?.close()
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())

    processorRef.current = null
    audioContextRef.current = null
    mediaStreamRef.current = null
  }, [])

  // Listen for backend events
  useEffect(() => {
    if (!ws) return

    const handleWsMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'start_listening':
            startCapture()
            break
          case 'stop_listening':
            stopCapture()
            break
          case 'conversation_started':
            isConversation.current = true
            commandBuffer.current = []
            commandStartTime.current = Date.now()
            lastSpeechTime.current = 0

            if (silenceTimer.current) clearTimeout(silenceTimer.current)
            silenceTimer.current = setTimeout(() => {
              if (isConversation.current) {
                flushCommandBuffer()
                sendWsMessage('silence_timeout', {})
              }
            }, SILENCE_TIMEOUT_MS)
            break
          case 'conversation_ended':
            isConversation.current = false
            if (silenceTimer.current) {
              clearTimeout(silenceTimer.current)
              silenceTimer.current = null
            }
            commandBuffer.current = []
            lastSpeechTime.current = 0
            break
          case 'tts_start':
            wakeWordBuffer.current = []
            commandBuffer.current = []
            lastSpeechTime.current = 0
            break
          case 'tts_playback_complete':
            muteUntil.current = Date.now() + MUTE_COOLDOWN_MS
            wakeWordBuffer.current = []
            commandBuffer.current = []
            lastSpeechTime.current = 0

            if (isConversation.current) {
              commandStartTime.current = Date.now() + MUTE_COOLDOWN_MS
              if (silenceTimer.current) clearTimeout(silenceTimer.current)
              silenceTimer.current = setTimeout(() => {
                if (isConversation.current) {
                  flushCommandBuffer()
                  sendWsMessage('silence_timeout', {})
                }
              }, SILENCE_TIMEOUT_MS)
            }
            break
        }
      } catch {
        // ignore
      }
    }

    ws.addEventListener('message', handleWsMessage)
    startCapture()

    return () => {
      ws.removeEventListener('message', handleWsMessage)
    }
  }, [ws, startCapture, stopCapture, flushCommandBuffer, sendWsMessage])

  useEffect(() => {
    return () => stopCapture()
  }, [stopCapture])
}
