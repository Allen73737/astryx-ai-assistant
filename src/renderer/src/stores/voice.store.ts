import { create } from 'zustand'

export type MicState = 'idle' | 'listening' | 'processing' | 'speaking'

interface VoiceStore {
  micState: MicState
  isWakeWordActive: boolean
  transcription: string
  waveformData: number[]
  volume: number
  isMuted: boolean

  setMicState: (state: MicState) => void
  setWakeWordActive: (active: boolean) => void
  setTranscription: (text: string) => void
  setWaveformData: (data: number[]) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  micState: 'idle',
  isWakeWordActive: false,
  transcription: '',
  waveformData: new Array(48).fill(2),
  volume: 0.8,
  isMuted: false,

  setMicState: (micState) => set({ micState }),
  setWakeWordActive: (isWakeWordActive) => set({ isWakeWordActive }),
  setTranscription: (transcription) => set({ transcription }),
  setWaveformData: (waveformData) => set({ waveformData }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted }))
}))
