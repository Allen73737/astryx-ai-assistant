import { useEffect } from 'react'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'

/**
 * Default voice shortcut assignments.
 * Ctrl+1 through Ctrl+9 map to popular premium neural voices.
 */
export const DEFAULT_VOICE_SHORTCUTS: Record<string, string> = {
  '1': 'en-GB-RyanNeural',       // British Male
  '2': 'en-US-AriaNeural',       // US Female — News, Novel
  '3': 'en-GB-MaisieNeural',     // British Female
  '4': 'en-US-GuyNeural',        // US Male — News, Novel
  '5': 'en-US-JennyNeural',      // US Female — General
  '6': 'en-GB-ThomasNeural',     // British Male
  '7': 'en-US-ChristopherNeural',// US Male — News, Novel
  '8': 'en-US-EricNeural',       // US Male — News, Novel
  '9': 'en-US-AnaNeural',        // US Female — Cartoon, Conversation
}

/** Reverse map: voice name → shortcut key */
function buildShortcutLabelMap(
  shortcuts: Record<string, string>
): Record<string, string> {
  const reverse: Record<string, string> = {}
  for (const [key, voice] of Object.entries(shortcuts)) {
    reverse[voice] = key
  }
  return reverse
}

/**
 * useVoiceShortcuts — Registers keyboard shortcuts for quick voice switching.
 *
 * Ctrl+<1-9>: Switch to the corresponding voice (see DEFAULT_VOICE_SHORTCUTS)
 * Ctrl+0:     Open the Voice Settings panel
 */
export function useVoiceShortcuts(): void {
  const ws = useJarvisStore((s) => s.ws)
  const selectedVoice = useJarvisStore((s) => s.selectedVoice)
  const setSelectedVoice = useJarvisStore((s) => s.setSelectedVoice)
  const setVoiceSettingsOpen = useJarvisStore((s) => s.setVoiceSettingsOpen)
  const voiceProfiles = useJarvisStore((s) => s.voiceProfiles)
  const activeProfileId = useJarvisStore((s) => s.activeProfileId)
  const setActiveProfileId = useJarvisStore((s) => s.setActiveProfileId)

  // Initialize shortcut mapping in store once on mount
  useEffect(() => {
    useJarvisStore.getState().setVoiceShortcuts(DEFAULT_VOICE_SHORTCUTS)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+P — Cycle to next profile
      if (e.ctrlKey && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        if (voiceProfiles.length === 0) return
        const currentIdx = voiceProfiles.findIndex((p) => p.id === activeProfileId)
        const nextIdx = (currentIdx + 1) % voiceProfiles.length
        const nextProfile = voiceProfiles[nextIdx]
        audioEngine.playClick()
        setActiveProfileId(nextProfile.id)
        setSelectedVoice(nextProfile.voice)
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'set_voice',
            payload: { voice: nextProfile.voice },
          }))
        }
        try { localStorage.setItem('astryx-active-profile', nextProfile.id) } catch {}
        showToast(`${nextProfile.icon} ${nextProfile.name}`, `Voice: ${nextProfile.voice}`)
        return
      }

      if (!e.ctrlKey && !e.metaKey) return

      // Ctrl+0 — Open Voice Settings
      if (e.key === '0') {
        e.preventDefault()
        audioEngine.playClick()
        setVoiceSettingsOpen(true)
        showToast('VOICE SHORTCUTS — Ctrl+0', 'Voice Settings opened')
        return
      }

      // Ctrl+<1-9> — Switch voice
      const key = e.key as string
      if (key >= '1' && key <= '9' && DEFAULT_VOICE_SHORTCUTS[key]) {
        e.preventDefault()
        const voiceName = DEFAULT_VOICE_SHORTCUTS[key]
        if (voiceName === selectedVoice) {
          showToast(voiceName, 'Already active')
          return
        }

        audioEngine.playClick()

        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'set_voice',
            payload: { voice: voiceName },
          }))
          setSelectedVoice(voiceName)
          showToast(`Ctrl+${key}: ${voiceName}`, 'Voice changed')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ws, selectedVoice, setSelectedVoice, setVoiceSettingsOpen, voiceProfiles, activeProfileId, setActiveProfileId])
}

/** DOM toast notification for shortcut feedback */
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(title: string, subtitle: string): void {
  const existing = document.getElementById('voice-toast')
  if (existing) existing.remove()
  if (toastTimer) clearTimeout(toastTimer)

  const el = document.createElement('div')
  el.id = 'voice-toast'
  el.style.cssText = [
    'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:999999;',
    'background:rgba(0,18,36,0.95);border:1px solid rgba(0,229,255,0.5);border-radius:8px;',
    'padding:10px 18px;backdrop-filter:blur(12px);box-shadow:0 0 30px rgba(0,229,255,0.15);',
    'display:flex;align-items:center;gap:10px;font-family:JetBrains Mono,monospace;',
    'animation:voiceToastIn 0.25s ease-out;pointer-events:none;',
  ].join('')
  el.innerHTML = [
    '<div style="display:flex;align-items:center;gap:10px">',
    '  <div style="font-size:14px">🎙️</div>',
    '  <div>',
    '    <div style="font-size:10px;color:#00e5ff;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">',
          title,
    '    </div>',
    '    <div style="font-size:8px;color:rgba(255,255,255,0.5);letter-spacing:0.15em;margin-top:2px">',
          subtitle,
    '    </div>',
    '  </div>',
    '</div>',
  ].join('')

  if (!document.getElementById('voice-toast-styles')) {
    const style = document.createElement('style')
    style.id = 'voice-toast-styles'
    style.textContent = [
      '@keyframes voiceToastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
      '@keyframes voiceToastOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(10px)}}',
    ].join('')
    document.head.appendChild(style)
  }

  document.body.appendChild(el)

  toastTimer = setTimeout(() => {
    el.style.animation = 'voiceToastOut 0.2s ease-in forwards'
    setTimeout(() => el.remove(), 200)
  }, 2000)
}

/** Get shortcut label for a voice name (used by VoiceSettings component) */
export function getShortcutForVoice(voiceName: string): string | null {
  const map = buildShortcutLabelMap(DEFAULT_VOICE_SHORTCUTS)
  return map[voiceName] || null
}
