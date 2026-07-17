import { ElectronAPI } from '@electron-toolkit/preload'

interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

interface SystemInfo {
  platform: string
  arch: string
  versions: {
    electron: string
    chrome: string
    node: string
  }
}

interface BackendConfig {
  httpUrl: string
  wsUrl: string
}

interface JarvisAPI {
  getDisplays: () => Promise<DisplayInfo[]>
  getSystemInfo: () => Promise<SystemInfo>
  getBackendConfig: () => Promise<BackendConfig>
  minimize: () => void
  maximize: () => void
  close: () => void
  showWindow: () => void
  openProjector: (displayId: number) => Promise<boolean>
  onToggleAR: (callback: () => void) => () => void
  onVoiceToggle?: (callback: () => void) => () => void
  setContentProtection?: (enable: boolean) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    jarvis: JarvisAPI
  }
}
