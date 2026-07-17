import { useState, useEffect } from 'react'

export function useAmbientLight() {
  const [glowIntensity, setGlowIntensity] = useState(1.0)

  useEffect(() => {
    const updateLight = () => {
      const hour = new Date().getHours()
      // Simulate ambient light adaptation:
      // Peak brightness at noon (1.0)
      // Dimmed at night (0.6)
      if (hour >= 20 || hour <= 6) {
        setGlowIntensity(0.6) // Night mode
      } else if (hour > 6 && hour < 10) {
        setGlowIntensity(0.8) // Morning
      } else if (hour >= 18 && hour < 20) {
        setGlowIntensity(0.8) // Evening
      } else {
        setGlowIntensity(1.0) // Day
      }
    }

    updateLight()
    const interval = setInterval(updateLight, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  return glowIntensity
}
