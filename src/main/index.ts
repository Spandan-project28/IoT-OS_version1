import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { HardwareManager } from './hardware/HardwareManager'
import { ArduinoCLIService } from './hardware/ArduinoCLIService'
import { SerialPortService } from './hardware/SerialPortService'
import { BoardIdentificationService } from './hardware/BoardIdentificationService'
import { hardwareIpcHandlers } from './ipc/hardwareIpcHandlers'
import { uploadIpcHandlers } from './ipc/uploadIpcHandlers'

// ---------------------------------------------------------------------------
// Window factory
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

  return mainWindow
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Legacy IPC test — retained until the scaffold is fully replaced.
  ipcMain.on('ping', () => console.log('pong'))

  // -------------------------------------------------------------------------
  // Hardware subsystem bootstrap
  //
  // Sequence:
  //   1. Initialize HardwareManager with concrete service implementations.
  //   2. Create the BrowserWindow.
  //   3. Register IPC handlers (requires the window reference for push events).
  //   4. Start the hardware discovery lifecycle.
  //
  // IPC handlers are registered before start() so that no events are missed if
  // the Renderer loads faster than the first hardware scan completes.
  // -------------------------------------------------------------------------

  // Step 1: Inject services into HardwareManager.
  HardwareManager.initialize({
    cli: ArduinoCLIService,
    ports: SerialPortService,
    identification: BoardIdentificationService
  })

  // Step 2: Create window.
  const mainWindow = createWindow()

  // Step 3: Register IPC handlers (attach to the window so push events work).
  hardwareIpcHandlers.register(mainWindow)

  // Upload handlers have no push events — no window reference needed.
  uploadIpcHandlers.register()

  // Step 4: Start hardware discovery (async — does not block window display).
  HardwareManager.start().catch((err: unknown) => {
    console.error('[HardwareManager] Failed to start hardware discovery:', err)
  })

  // -------------------------------------------------------------------------
  // macOS re-creation
  // -------------------------------------------------------------------------
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      hardwareIpcHandlers.register(newWindow)
    }
  })
})

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

app.on('before-quit', () => {
  // Stop hardware discovery and remove IPC handlers before the process exits.
  // This prevents lingering polling intervals or open handles from delaying
  // the shutdown sequence on Windows.
  HardwareManager.stop()
  hardwareIpcHandlers.remove()
  uploadIpcHandlers.remove()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
