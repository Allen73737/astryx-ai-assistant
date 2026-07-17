import { app, shell, BrowserWindow, ipcMain, Tray, Menu, screen, globalShortcut, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'

/** Active window references */
let mainWindow: BrowserWindow | null = null
let projectorWindow: BrowserWindow | null = null
let tray: Tray | null = null
let backendProcess: ChildProcess | null = null

/** Backend WebSocket connection state */
const BACKEND_URL = 'http://127.0.0.1:8002'
const BACKEND_WS = 'ws://127.0.0.1:8002/ws'

let leftHUD: BrowserWindow | null = null
let rightHUD: BrowserWindow | null = null
let centerHUD: BrowserWindow | null = null

/* ═══════════════════ BACKEND PROCESS MANAGEMENT ═══════════════════ */

let backendRetries = 0
const MAX_BACKEND_RETRIES = 5

async function checkBackendRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}

async function startBackend(): Promise<void> {
  if (backendProcess) return

  const isRunning = await checkBackendRunning()
  if (isRunning) {
    console.log('[Backend] Found existing backend instance. Skipping spawn.')
    console.log('[Backend] WARNING: If you updated backend code, you MUST kill the orphaned python process manually!')
    return
  }

  const backendDir = join(__dirname, '../../backend')
  const mainPy = join(backendDir, 'main.py')

  if (!existsSync(mainPy)) {
    console.error('[Backend] main.py not found at', mainPy)
    return
  }

  const venvPythonWin = join(backendDir, '.venv', 'Scripts', 'python.exe')
  const venvPythonUnix = join(backendDir, '.venv', 'bin', 'python')
  const pythonPath = existsSync(venvPythonWin)
    ? venvPythonWin
    : existsSync(venvPythonUnix)
      ? venvPythonUnix
      : 'python'

  console.log(`[Backend] Starting Python backend using: ${pythonPath}`)

  backendProcess = spawn(pythonPath, [mainPy], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  backendProcess.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.log('[Backend]', msg)
  })

  backendProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.error('[Backend ERR]', msg)
  })

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null
    if ((app as any).isQuitting) return

    backendRetries++
    if (backendRetries > MAX_BACKEND_RETRIES) {
      console.error(`[Backend] Process exited too many times. Giving up.`)
      return
    }

    console.warn(`[Backend] Process exited (code=${code}, signal=${signal}). Restarting in 3s (Attempt ${backendRetries}/${MAX_BACKEND_RETRIES})...`)
    // Auto-restart after 3 seconds
    setTimeout(() => {
      if (!(app as any).isQuitting) {
        startBackend()
      }
    }, 3000)
  })

  backendProcess.on('error', (err) => {
    console.error('[Backend] Failed to start:', err.message)
    backendProcess = null
  })
}

function stopBackend(): void {
  if (backendProcess) {
    console.log('[Backend] Stopping...')
    backendProcess.kill('SIGTERM')
    backendProcess = null
  }
}

/* ═══════════════════ WINDOW CREATION ═══════════════════ */

function showAndFocusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createGhostWindow()
  } else {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.setAlwaysOnTop(true)
    mainWindow.show()
    mainWindow.focus()
    mainWindow.setAlwaysOnTop(false)
  }
}

function createGhostWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const window = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fullscreen: true,
    show: true,
    frame: false,
    backgroundColor: '#00050d', // Solid deep JARVIS blue-black, no acrylic grey fog
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../resources/icon.png'),
    alwaysOnTop: true,
    skipTaskbar: false
  })

  // Start completely hidden. React will call showWindow() when Voice Engine wakes.
  
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  return window
}

function createProjectorWindow(displayId: number): BrowserWindow | null {
  const displays = screen.getAllDisplays()
  const targetDisplay = displays.find((d) => d.id === displayId)
  if (!targetDisplay) return null

  const window = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    backgroundColor: '#000a19',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/projector`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/projector' })
  }

  window.on('closed', () => {
    if (projectorWindow === window) {
      projectorWindow = null
    }
  })

  return window
}

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  const trayIcon = icon.resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show JARVIS-X',
      click: (): void => {
        showAndFocusMainWindow()
      }
    },
    {
      label: 'Toggle Projector',
      click: (): void => {
        if (projectorWindow) {
          projectorWindow.close()
          projectorWindow = null
        } else {
          const displays = screen.getAllDisplays()
          if (displays.length > 1) {
            projectorWindow = createProjectorWindow(displays[1].id)
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: (): void => {
        (app as any).isQuitting = true
        stopBackend()
        app.quit()
      }
    }
  ])

  tray.setToolTip('JARVIS-X')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    showAndFocusMainWindow()
  })
}

function registerIpcHandlers(): void {
  /* System information */
  ipcMain.handle('system:getDisplays', () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label,
      bounds: d.bounds,
      isPrimary: d.id === screen.getPrimaryDisplay().id
    }))
  })

  ipcMain.handle('system:getInfo', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
      }
    }
  })

  /* Window controls */
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => {
    (app as any).isQuitting = true
    stopBackend()
    app.quit()
  })
  ipcMain.on('window:show', () => {
    if (mainWindow?.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow?.setAlwaysOnTop(true)
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.setAlwaysOnTop(false)
  })
  ipcMain.on('window:setContentProtection', (_, protect: boolean) => {
    mainWindow?.setContentProtection(protect)
  })

  /* Projector control */
  ipcMain.handle('projector:open', (_, displayId: number) => {
    if (projectorWindow) {
      projectorWindow.close()
    }
    projectorWindow = createProjectorWindow(displayId)
    return projectorWindow !== null
  })

  ipcMain.on('projector:close', () => {
    projectorWindow?.close()
    projectorWindow = null
  })

  /* Backend config */
  ipcMain.handle('backend:getConfig', () => ({
    httpUrl: BACKEND_URL,
    wsUrl: BACKEND_WS
  }))
}

function registerGlobalShortcuts(): void {
  const register = (key: string, callback: () => void): void => {
    const success = globalShortcut.register(key, callback)
    if (success) {
      console.log(`[Shortcuts] Registered successfully: ${key}`)
    } else {
      console.error(`[Shortcuts] FAILED to register: ${key}. It might be in use by another application.`)
    }
  }

  /* Alt+J / Ctrl+J — focus JARVIS-X and trigger voice listening */
  const focusAndWake = () => {
    const isNew = !mainWindow || mainWindow.isDestroyed()
    showAndFocusMainWindow()
    if (isNew && mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        // slight delay to let React mount
        setTimeout(() => mainWindow?.webContents.send('shortcut:voiceToggle'), 500)
      })
    } else {
      mainWindow?.webContents.send('shortcut:voiceToggle')
    }
  }

  register('Alt+J', focusAndWake)
  register('CommandOrControl+J', focusAndWake)

  /* Alt+P — toggle projector */
  register('Alt+P', () => {
    if (projectorWindow) {
      projectorWindow.close()
      projectorWindow = null
    } else {
      const displays = screen.getAllDisplays()
      if (displays.length > 1) {
        projectorWindow = createProjectorWindow(displays[1].id)
      }
    }
  })

  /* Alt+A — toggle AR mode (sends to renderer) */
  register('Alt+A', () => {
    mainWindow?.webContents.send('shortcut:toggleAR')
  })

  /* Ctrl+Space — trigger voice listening */
  register('CommandOrControl+Space', () => {
    mainWindow?.webContents.send('shortcut:voiceToggle')
  })

  /* Alt+S — wake the entire setup with the screen and voice (Show, Focus, and trigger Voice Listening) */
  register('Alt+S', () => {
    const isNew = !mainWindow || mainWindow.isDestroyed()
    showAndFocusMainWindow()
    if (isNew && mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        // slight delay to let React mount
        setTimeout(() => mainWindow?.webContents.send('shortcut:voiceToggle'), 500)
      })
    } else {
      mainWindow?.webContents.send('shortcut:voiceToggle')
    }
  })

  /* Alt+V — trigger/toggle voice listening specifically */
  register('Alt+V', () => {
    mainWindow?.webContents.send('shortcut:voiceToggle')
  })
}

/* ═══════════════════ APP LIFECYCLE ═══════════════════ */

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
;(app as any).isQuitting = false

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jarvis-x')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Start the Python backend FIRST
  startBackend()

  registerIpcHandlers()
  mainWindow = createGhostWindow()
  createTray()
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createGhostWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    /* Keep running in tray on Windows */
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopBackend()
})

app.on('before-quit', () => {
  (app as any).isQuitting = true
  stopBackend()
})
