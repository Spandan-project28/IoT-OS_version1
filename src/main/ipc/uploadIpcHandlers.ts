/**
 * Upload IPC Handlers
 *
 * Registers all ipcMain handlers for the upload subsystem.
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
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to remove handlers on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   upload:compile          → UploadService.compile(request)
 *   upload:upload           → UploadService.upload(firmware)
 *   upload:compileAndUpload → UploadService.compileAndUpload(request)
 *
 * Lifecycle:
 *   uploadIpcHandlers.register() — called once after app is ready.
 *   uploadIpcHandlers.remove()   — called on app quit or window close.
 */

import { ipcMain } from 'electron'
import { UploadService } from '../hardware/UploadService'
import { UploadIpcChannels } from '@shared/types/ipc'
import type { IUploadRequest, ICompiledFirmware } from '@shared/types/upload'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the upload subsystem.
 *
 * Must be called exactly once during app startup, after the BrowserWindow
 * has been created. No window reference is needed — all upload channels
 * are invoke/response only (no push events in this slice).
 */
function registerUploadIpcHandlers(): void {
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
}

/**
 * Removes all ipcMain handlers registered by this module.
 *
 * Must be called when the application is quitting to prevent stale handlers
 * from accumulating across hot-reloads in development.
 */
function removeUploadIpcHandlers(): void {
  ipcMain.removeHandler(UploadIpcChannels.compile)
  ipcMain.removeHandler(UploadIpcChannels.upload)
  ipcMain.removeHandler(UploadIpcChannels.compileAndUpload)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const uploadIpcHandlers = Object.freeze({
  register: registerUploadIpcHandlers,
  remove: removeUploadIpcHandlers
})
