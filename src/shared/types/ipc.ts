/**
 * IPC Contracts
 *
 * The single source of truth for every IPC channel that crosses the
 * Main ↔ Renderer boundary.
 *
 * Architectural rules:
 * - Channel names are string literals, not enums, so they can be used directly
 *   with ipcMain.handle() and ipcRenderer.invoke() without an extra lookup.
 * - Payload types mirror the domain types from @shared/types exactly.
 *   No data transformation is performed at the IPC layer.
 *
 * Hardware channels (Phase 2, Slice 5):
 *   hardware:getState   — Renderer → Main invoke, returns IHardwareState snapshot.
 *   hardware:refresh    — Renderer → Main invoke, forces re-scan, returns IHardwareState.
 *   hardware:stateChanged — Main → Renderer push, sent on every HardwareManager state change.
 *
 * Upload channels (Phase 3, Slice 9):
 *   upload:compile          — Renderer → Main invoke, returns ICompileResult.
 *   upload:upload           — Renderer → Main invoke, returns IUploadResult.
 *   upload:compileAndUpload — Renderer → Main invoke, returns IUploadResult.
 *
 * Usage (Main):
 *   ipcMain.handle(HardwareIpcChannels.getState, () => HardwareManager.getState())
 *   ipcMain.handle(UploadIpcChannels.compileAndUpload, (_, req) => UploadService.compileAndUpload(req))
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(HardwareIpcChannels.getState)
 *   ipcRenderer.invoke(UploadIpcChannels.compile, request)
 *
 * Usage (Renderer):
 *   window.api.hardware.getState()
 *   window.api.upload.compileAndUpload(request)
 */

import type { IHardwareState } from './hardware'
import type { IUploadRequest, ICompiledFirmware, ICompileResult, IUploadResult } from './upload'

// ---------------------------------------------------------------------------
// Hardware channels
// ---------------------------------------------------------------------------

/**
 * IPC channel names for the hardware subsystem.
 *
 * Using a const object (rather than an enum) keeps the values as plain strings
 * that TypeScript narrows correctly when passed to ipcMain.handle() and
 * ipcRenderer.invoke() — both of which accept `string`, not `enum`.
 */
export const HardwareIpcChannels = Object.freeze({
  /**
   * Renderer → Main (invoke).
   * Returns the current IHardwareState without triggering any side effects.
   */
  getState: 'hardware:getState' as const,

  /**
   * Renderer → Main (invoke).
   * Forces an out-of-cycle hardware re-scan: re-queries Arduino CLI, performs
   * an immediate SerialPort.list() poll, and re-runs board identification.
   * Returns the updated IHardwareState after all I/O completes.
   * Also emits hardwareStateChanged as a side effect (push to Renderer).
   */
  refresh: 'hardware:refresh' as const,

  /**
   * Main → Renderer (push / one-way).
   * Sent whenever HardwareManager emits a hardwareStateChanged event.
   * Renderer subscribes via window.api.hardware.onStateChanged().
   */
  stateChanged: 'hardware:stateChanged' as const
} as const)

// ---------------------------------------------------------------------------
// Hardware payload types
// ---------------------------------------------------------------------------

/**
 * The payload returned by the hardware:getState invoke channel.
 * A point-in-time snapshot of the entire hardware layer.
 */
export type HardwareGetStateResult = IHardwareState

/**
 * The payload returned by the hardware:refresh invoke channel.
 * Same shape as HardwareGetStateResult; the behavioral difference is that
 * refresh forces real I/O before assembling the snapshot.
 */
export type HardwareRefreshResult = IHardwareState

/**
 * The payload pushed on the hardware:stateChanged one-way channel.
 * Renderer receives this whenever hardware state mutates.
 */
export type HardwareStateChangedPayload = IHardwareState

// ---------------------------------------------------------------------------
// Upload channels
// ---------------------------------------------------------------------------

/**
 * IPC channel names for the upload subsystem.
 *
 * Intentionally separate from HardwareIpcChannels — the upload domain
 * is independent of hardware detection and must remain decoupled.
 *
 * All three channels are Renderer → Main invoke calls.
 * No push events are defined in this slice (progress streaming is deferred).
 *
 * Usage (Main):
 *   ipcMain.handle(UploadIpcChannels.compileAndUpload, (_, req) => UploadService.compileAndUpload(req))
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(UploadIpcChannels.compile, request)
 *
 * Usage (Renderer):
 *   window.api.upload.compile(request)
 *   window.api.upload.compileAndUpload(request)
 */
export const UploadIpcChannels = Object.freeze({
  /**
   * Renderer → Main (invoke).
   * Compiles firmware source and returns a compiled artifact on success.
   * Request:  IUploadRequest
   * Response: ICompileResult
   */
  compile: 'upload:compile' as const,

  /**
   * Renderer → Main (invoke).
   * Uploads a previously compiled firmware artifact to the target port.
   * Request:  ICompiledFirmware
   * Response: IUploadResult
   */
  upload: 'upload:upload' as const,

  /**
   * Renderer → Main (invoke).
   * Compiles firmware source then uploads to the target port in one call.
   * Stops and returns the compile error if compilation fails.
   * Request:  IUploadRequest
   * Response: IUploadResult
   */
  compileAndUpload: 'upload:compileAndUpload' as const
} as const)

// ---------------------------------------------------------------------------
// Upload payload type aliases
//
// These are documentation-only type aliases that name each channel's request
// and response types explicitly. They are not imported by the IPC handlers
// or preload (which import directly from @shared/types/upload) but serve as
// a clear contract reference for this file's readers.
// ---------------------------------------------------------------------------

/**
 * Request payload for the upload:compile invoke channel.
 */
export type UploadCompileRequest = IUploadRequest

/**
 * Response payload for the upload:compile invoke channel.
 */
export type UploadCompileResult = ICompileResult

/**
 * Request payload for the upload:upload invoke channel.
 */
export type UploadUploadRequest = ICompiledFirmware

/**
 * Response payload for the upload:upload invoke channel.
 */
export type UploadUploadResult = IUploadResult

/**
 * Request payload for the upload:compileAndUpload invoke channel.
 */
export type UploadCompileAndUploadRequest = IUploadRequest

/**
 * Response payload for the upload:compileAndUpload invoke channel.
 */
export type UploadCompileAndUploadResult = IUploadResult
