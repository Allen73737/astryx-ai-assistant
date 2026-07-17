import { create } from 'zustand'

interface FacePosition {
  x: number
  y: number
  z: number
}

interface ARStore {
  isARMode: boolean
  isFaceTracking: boolean
  isParallaxEnabled: boolean
  facePosition: FacePosition
  smoothedFacePosition: FacePosition
  faceData: any | null
  ambientLightLevel: number
  handGesture: string | null
  emotion: string | null
  attentionScore: number

  setARMode: (active: boolean) => void
  setFaceTracking: (active: boolean) => void
  setParallaxEnabled: (enabled: boolean) => void
  setFacePosition: (position: FacePosition) => void
  setSmoothedFacePosition: (position: FacePosition) => void
  setFaceData: (data: any | null) => void
  setAmbientLightLevel: (level: number) => void
  setHandGesture: (gesture: string | null) => void
  setEmotion: (emotion: string | null) => void
  setAttentionScore: (score: number) => void
}

export const useARStore = create<ARStore>((set) => ({
  isARMode: false,
  isFaceTracking: false,
  isParallaxEnabled: true,
  facePosition: { x: 0, y: 0, z: 0 },
  smoothedFacePosition: { x: 0, y: 0, z: 0 },
  faceData: null,
  ambientLightLevel: 0.5,
  handGesture: null,
  emotion: null,
  attentionScore: 1.0,

  setARMode: (isARMode) => set({ isARMode }),
  setFaceTracking: (isFaceTracking) => set({ isFaceTracking }),
  setParallaxEnabled: (isParallaxEnabled) => set({ isParallaxEnabled }),
  setFacePosition: (facePosition) => set({ facePosition }),
  setSmoothedFacePosition: (smoothedFacePosition) => set({ smoothedFacePosition }),
  setFaceData: (faceData) => set({ faceData }),
  setAmbientLightLevel: (ambientLightLevel) => set({ ambientLightLevel }),
  setHandGesture: (handGesture) => set({ handGesture }),
  setEmotion: (emotion) => set({ emotion }),
  setAttentionScore: (attentionScore) => set({ attentionScore })
}))
