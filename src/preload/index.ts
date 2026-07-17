import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/** Type-safe API exposed to renderer */
const jarvisAPI = {
  /** System */
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('system:getDisplays'),
  getSystemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke('system:getInfo'),
  getBackendConfig: (): Promise<BackendConfig> => ipcRenderer.invoke('backend:getConfig'),

  /** Window controls */
  minimize: (): void => ipcRenderer.send('window:minimize'),
  maximize: (): void => ipcRenderer.send('window:maximize'),
  close: (): void => ipcRenderer.send('window:close'),
  showWindow: (): void => ipcRenderer.send('window:show'),
  setContentProtection: (protect: boolean): void => ipcRenderer.send('window:setContentProtection', protect),

  /** Projector */
  openProjector: (displayId: number): Promise<boolean> =>
    ipcRenderer.invoke('projector:open', displayId),
  closeProjector: (): void => ipcRenderer.send('projector:close'),

  /** Event listeners from main process */
  onToggleAR: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('shortcut:toggleAR', handler)
    return () => ipcRenderer.removeListener('shortcut:toggleAR', handler)
  },
  onVoiceToggle: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('shortcut:voiceToggle', handler)
    return () => ipcRenderer.removeListener('shortcut:voiceToggle', handler)
  }
}

/** Type declarations */
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

/* Expose APIs to renderer via contextBridge */
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('jarvis', jarvisAPI)
  } catch (error) {
    console.error('Failed to expose APIs:', error)
  }
} else {
  // @ts-ignore fallback for non-isolated context
  window.electron = electronAPI
  // @ts-ignore fallback for non-isolated context
  window.jarvis = jarvisAPI
}
