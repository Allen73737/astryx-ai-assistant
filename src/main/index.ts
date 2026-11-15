import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'

let lmsProcess: ChildProcess | null = null
let backendProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Phase 7: Global Hotkey Listener
  globalShortcut.register('CommandOrControl+Space', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window-close', () => mainWindow?.close())

  // ── AUTOLAUNCH BACKENDS ──
  console.log("Starting LM Studio Server...")
  lmsProcess = spawn('lms', ['server', 'start'], { shell: true, stdio: 'ignore' })
  lmsProcess.on('error', (err) => console.error('LMS spawn error:', err))

  console.log("Starting Python AI Backend...")
  const projectRoot = app.isPackaged ? process.resourcesPath : join(__dirname, '../../')
  const pythonExe = join(projectRoot, 'backend', '.venv', 'Scripts', 'python.exe')
  const mainPy = join(projectRoot, 'backend', 'main.py')

  backendProcess = spawn(pythonExe, [mainPy], {
    cwd: join(projectRoot, 'backend'),
    shell: false
  })

  backendProcess.on('error', (err) => console.error('Backend spawn error:', err))
  backendProcess.stdout?.on('data', (data) => console.log(`[Python]: ${data}`))
  backendProcess.stderr?.on('data', (data) => console.error(`[Python ERR]: ${data}`))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error)
})

app.on('before-quit', () => {
  console.log("Shutting down backends...")
  if (lmsProcess) lmsProcess.kill()
  if (backendProcess) backendProcess.kill()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

