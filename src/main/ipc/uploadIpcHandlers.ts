/**
 * Upload IPC Handlers
 *
 * Registers all ipcMain handlers for the upload subsystem and manages the
 * push channel that forwards UploadEventBus events to the Renderer.
 *
 * Architectural rules:
 * - Completely separate from hardwareIpcHandlers.ts — upload and hardware
 *   detection are independent domains.
 * - This module owns the boundary between the Main process and the upload IPC layer.
 * - It NEVER accesses UploadService internals directly — it delegates to the
 *   three public methods: compile(), upload(), compileAndUpload().
 * - It performs NO business logic. It is a thin, typed delegation layer only.
 * - It does NOT transform UploadService results. Typed results cross the bridge
 *   exactly as returned — errors included.
 * - It never throws across the IPC boundary. UploadService already returns typed
 *   error results instead of throwing, so no try/catch is needed in handlers.
 * - Push events use webContents.send() guarded against destroyed windows, matching
 *   the same safety pattern as hardwareIpcHandlers.ts and serialIpcHandlers.ts.
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to remove handlers on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   upload:compile          → UploadService.compile(request)
 *   upload:upload           → UploadService.upload(firmware)
 *   upload:compileAndUpload → UploadService.compileAndUpload(request)
 *
 * Push channels driven here (Main → Renderer):
 *   upload:log → sent on every UploadEventBus 'upload:log' event
 *
 * Lifecycle:
 *   uploadIpcHandlers.register(mainWindow) — called once after app is ready.
 *   uploadIpcHandlers.remove()             — called on app quit or window close.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { UploadService } from '../hardware/UploadService'
import { UploadEventBus } from '../hardware/UploadEventBus'
import { UploadIpcChannels } from '@shared/types/ipc'
import type { IUploadRequest, ICompiledFirmware, IUploadLogPayload } from '@shared/types/upload'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Cached reference to the main BrowserWindow, used to send push events. */
let _mainWindow: BrowserWindow | null = null

/**
 * The listener registered on UploadEventBus('upload:log').
 * Stored so it can be removed precisely during teardown without calling
 * removeAllListeners() (which would discard other internal subscribers).
 */
let _logListener: ((payload: IUploadLogPayload) => void) | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends the upload:log push event to the Renderer if the window still exists
 * and its webContents have not been destroyed.
 *
 * Guard conditions mirror hardwareIpcHandlers.ts and serialIpcHandlers.ts.
 */
function pushLogToRenderer(payload: IUploadLogPayload): void {
  if (_mainWindow && !_mainWindow.webContents.isDestroyed()) {
    _mainWindow.webContents.send(UploadIpcChannels.log, payload)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the upload subsystem.
 *
 * Must be called exactly once during app startup, after the BrowserWindow
 * has been created. The window reference is required to send upload:log
 * push events as compile/upload subprocesses produce output.
 *
 * @param mainWindow - The application's primary BrowserWindow. Required to
 *   send push events (upload:log) to the Renderer.
 */
function registerUploadIpcHandlers(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow
  // -------------------------------------------------------------------------
  // Invoke: upload:compile
  //
  // Compiles firmware source using arduino-cli and returns a compiled artifact.
  // The ICompiledFirmware artifact in the success result holds a reference to
  // a temporary build directory. The Renderer must pass it back via upload:upload
  // to complete the pipeline and trigger cleanup.
  //
  // Response: ICompileResult
  //   { status: 'success', firmware: ICompiledFirmware }
  //   { status: 'error',   code, error, raw? }
  // -------------------------------------------------------------------------
  ipcMain.handle(UploadIpcChannels.compile, (_event, request: IUploadRequest) => {
    return UploadService.compile(request)
  })

  // -------------------------------------------------------------------------
  // Invoke: upload:upload
  //
  // Uploads a previously compiled firmware artifact to the board's port.
  // The artifact's temporary build directory is cleaned up by UploadService
  // regardless of success or failure — the artifact is spent after this call.
  //
  // Response: IUploadResult
  //   { status: 'success' }
  //   { status: 'error',  code, error, raw? }
  // -------------------------------------------------------------------------
  ipcMain.handle(UploadIpcChannels.upload, (_event, firmware: ICompiledFirmware) => {
    return UploadService.upload(firmware)
  })

  // -------------------------------------------------------------------------
  // Invoke: upload:compileAndUpload
  //
  // Convenience handler: compiles firmware then uploads in a single call.
  // Stops and returns the compile error if compilation fails — no upload
  // is attempted in that case.
  //
  // This is the primary entry point for the one-click upload workflow in V0.1.
  //
  // Response: IUploadResult
  //   { status: 'success' }
  //   { status: 'error',  code, error, raw? }
  // -------------------------------------------------------------------------
  ipcMain.handle(UploadIpcChannels.compileAndUpload, (_event, request: IUploadRequest) => {
    return UploadService.compileAndUpload(request)
  })

  // -------------------------------------------------------------------------
  // Push: upload:log
  //
  // Subscribe to the internal UploadEventBus 'upload:log' event and forward
  // it to the Renderer via webContents.send(). This makes the Integrated
  // Terminal reactive to compile/upload output without polling from the UI.
  //
  // One event per command/stdout/stderr chunk — never batched until the
  // subprocess exits.
  // -------------------------------------------------------------------------
  _logListener = (payload: IUploadLogPayload) => {
    pushLogToRenderer(payload)
  }

  UploadEventBus.on('upload:log', _logListener)
}

/**
 * Removes all ipcMain handlers and UploadEventBus listeners registered by
 * this module.
 *
 * Must be called when the application is quitting to prevent stale handlers
 * from accumulating across hot-reloads in development.
 */
function removeUploadIpcHandlers(): void {
  ipcMain.removeHandler(UploadIpcChannels.compile)
  ipcMain.removeHandler(UploadIpcChannels.upload)
  ipcMain.removeHandler(UploadIpcChannels.compileAndUpload)

  if (_logListener) {
    UploadEventBus.off('upload:log', _logListener)
    _logListener = null
  }

  _mainWindow = null
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const uploadIpcHandlers = Object.freeze({
  register: registerUploadIpcHandlers,
  remove: removeUploadIpcHandlers
})
