import { useEffect, useRef, useCallback } from 'react'
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'
import { useJarvisStore } from '@/stores/jarvis.store'
import { useARStore } from '@/stores/ar.store'

export function useFaceTracking() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const isRunningRef = useRef(false)
  const lastVideoTimeRef = useRef(-1)
  const requestRef = useRef(0)

  const isARMode = useJarvisStore((s) => s.orbState === 'ar_mode')
  const setFaceData = useARStore((s) => s.setFaceData)

  const initFaceLandmarker = useCallback(async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    )
    landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1
    })
  }, [])

  const startTracking = useCallback(async () => {
    if (!landmarkerRef.current) await initFaceLandmarker()
    
    videoRef.current = document.createElement('video')
    videoRef.current.playsInline = true
    videoRef.current.muted = true
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      isRunningRef.current = true
      detectFace()
    } catch (err) {
      console.error('Camera access denied:', err)
    }
  }, [initFaceLandmarker])

  const stopTracking = useCallback(() => {
    isRunningRef.current = false
    if (requestRef.current) cancelAnimationFrame(requestRef.current)
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
    }
    setFaceData(null)
  }, [setFaceData])

  const detectFace = useCallback(() => {
    if (!isRunningRef.current || !videoRef.current || !landmarkerRef.current) return

    const now = performance.now()
    if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = videoRef.current.currentTime
      const result = landmarkerRef.current.detectForVideo(videoRef.current, now)
      
      if (result.faceLandmarks.length > 0) {
        const landmarks = result.faceLandmarks[0]
        
        // Calculate basic head pose and bounding box from landmarks
        let minX = 1, minY = 1, maxX = 0, maxY = 0
        landmarks.forEach(p => {
          if (p.x < minX) minX = p.x
          if (p.x > maxX) maxX = p.x
          if (p.y < minY) minY = p.y
          if (p.y > maxY) maxY = p.y
        })
        // Calculate 3D rotations for Phase 2
        // Key landmarks: 1 (Nose), 33 (Left Eye), 263 (Right Eye), 152 (Chin), 10 (Top)
        const nose = landmarks[1]
        const leftEye = landmarks[33]
        const rightEye = landmarks[263]
        const chin = landmarks[152]
        const top = landmarks[10]

        const dx = rightEye.x - leftEye.x
        const dy = rightEye.y - leftEye.y
        // Roll: angle between eyes in XY plane
        const roll = Math.atan2(dy, dx) * (180 / Math.PI)

        // Yaw: difference in Z depth between eyes
        const yaw = Math.atan2(leftEye.z - rightEye.z, dx) * (180 / Math.PI)

        // Pitch: difference in Z depth between chin and top of head
        const pitch = Math.atan2(chin.z - top.z, chin.y - top.y) * (180 / Math.PI)

        setFaceData({
          x: minX + (maxX - minX) / 2,
          y: minY + (maxY - minY) / 2,
          width: maxX - minX,
          height: maxY - minY,
          rotation: { pitch, yaw, roll },
          landmarks
        })
      } else {
        setFaceData(null)
      }
    }
    
    requestRef.current = requestAnimationFrame(detectFace)
  }, [setFaceData])

  useEffect(() => {
    if (isARMode) {
      startTracking()
    } else {
      stopTracking()
    }
    return () => stopTracking()
  }, [isARMode, startTracking, stopTracking])
}
