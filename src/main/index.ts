import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { HardwareManager } from './hardware/HardwareManager'
import { ArduinoCLIService } from './hardware/ArduinoCLIService'
import { SerialPortService } from './hardware/SerialPortService'
import { BoardIdentificationService } from './hardware/BoardIdentificationService'
import { hardwareIpcHandlers } from './ipc/hardwareIpcHandlers'
import { uploadIpcHandlers } from './ipc/uploadIpcHandlers'
import { serialIpcHandlers } from './ipc/serialIpcHandlers'
import { aiIpcHandlers } from './ipc/aiIpcHandlers'
import { projectIpcHandlers } from './ipc/projectIpcHandlers'
import { settingsIpcHandlers } from './ipc/settingsIpcHandlers'
import { WorkspaceService } from './services/WorkspaceService'
import { ProjectService } from './services/ProjectService'

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

  // Step 0: Resolve and create the workspace root. Must complete before
  // projectIpcHandlers.register() so the workspace:info handler never races
  // an uncreated directory. Independent of the hardware subsystem below —
  // ordering between the two is not architecturally constrained.
  await WorkspaceService.initialize()

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

  // Upload handlers have a push event (upload:log, Phase 10) — window
  // reference is required.
  uploadIpcHandlers.register(mainWindow)

  // Serial handlers have push events (serial:data, serial:statusChanged) —
  // window reference is required.
  serialIpcHandlers.register(mainWindow)

  // AI handlers are invoke/response only — no push events, no window reference needed.
  aiIpcHandlers.register()

  // Project/workspace handlers — only workspace:info is live in Slice 28.
  // window reference is accepted now for the project:saved push channel
  // added in Slice 32.
  projectIpcHandlers.register(mainWindow)

  // Settings handlers are invoke/response only — no push events, no window
  // reference needed. No ordering constraint relative to the other five
  // handler groups (Phase 8, Slice 35).
  settingsIpcHandlers.register()

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
      uploadIpcHandlers.register(newWindow)
      serialIpcHandlers.register(newWindow)
      aiIpcHandlers.register()
      projectIpcHandlers.register(newWindow)
      settingsIpcHandlers.register()
    }
  })
})

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

// Set once flush() has been attempted and app.quit() is re-triggered, so the
// second before-quit pass lets the quit proceed instead of preventing it again.
let _isQuitting = false

app.on('before-quit', (event) => {
  if (_isQuitting) return
  event.preventDefault()

  // Persist the last known project state before the process exits (Slice
  // 32). Best-effort — a flush failure is logged but never blocks quitting.
  ProjectService.flush()
    .catch((err: unknown) => {
      console.error('[main] Flush on quit failed:', err)
    })
    .finally(() => {
      _isQuitting = true
      app.quit()
    })
})

app.on('will-quit', () => {
  // Stop hardware discovery and remove IPC handlers before the process exits.
  // This prevents lingering polling intervals or open handles from delaying
  // the shutdown sequence on Windows.
  HardwareManager.stop()
  hardwareIpcHandlers.remove()
  uploadIpcHandlers.remove()
  // Close all active serial sessions and remove serial IPC handlers.
  // serialIpcHandlers.remove() calls SerialService.closeAll() internally.
  serialIpcHandlers.remove()
  // AI handlers have no sessions or OS resources — removal is a simple deregister.
  aiIpcHandlers.remove()
  // Project/workspace handlers have no sessions or OS resources in Slice 28 —
  // removal is a simple deregister. WorkspaceService holds no OS handles and
  // needs no explicit stop() call.
  projectIpcHandlers.remove()
  // Settings handlers have no sessions or OS resources — removal is a
  // simple deregister (Phase 8, Slice 35).
  settingsIpcHandlers.remove()
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
