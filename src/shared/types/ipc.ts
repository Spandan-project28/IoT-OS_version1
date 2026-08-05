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
 * Upload channels (Phase 3, Slice 9; upload:log added Phase 10):
 *   upload:compile          — Renderer → Main invoke, returns ICompileResult.
 *   upload:upload           — Renderer → Main invoke, returns IUploadResult.
 *   upload:compileAndUpload — Renderer → Main invoke, returns IUploadResult.
 *   upload:log              — Main → Renderer push, streams each command/stdout/stderr
 *                              chunk live as compile/upload subprocesses produce it.
 *
 * Serial channels (Phase 4, Slice 15):
 *   serial:open          — Renderer → Main invoke, opens a port, returns ISerialResult.
 *   serial:close         — Renderer → Main invoke, closes a port, returns ISerialResult.
 *   serial:write         — Renderer → Main invoke, writes text to a port, returns ISerialResult.
 *   serial:data          — Main → Renderer push, delivers one parsed line per event.
 *   serial:statusChanged — Main → Renderer push, delivers session lifecycle transitions.
 *
 * AI channels (Phase 6, Slice 24):
 *   ai:generate — Renderer → Main invoke, generates firmware from a prompt, returns IAIResult.
 *
 * Usage (Main):
 *   ipcMain.handle(HardwareIpcChannels.getState, () => HardwareManager.getState())
 *   ipcMain.handle(UploadIpcChannels.compileAndUpload, (_, req) => UploadService.compileAndUpload(req))
 *   ipcMain.handle(SerialIpcChannels.open, (_, req) => SerialService.open(req))
 *   ipcMain.handle(AiIpcChannels.generate, (_, req) => AIService.generate(req))
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(HardwareIpcChannels.getState)
 *   ipcRenderer.invoke(UploadIpcChannels.compile, request)
 *   ipcRenderer.invoke(SerialIpcChannels.open, request)
 *   ipcRenderer.on(SerialIpcChannels.data, handler)
 *   ipcRenderer.invoke(AiIpcChannels.generate, request)
 *
 * Usage (Renderer):
 *   window.api.hardware.getState()
 *   window.api.upload.compileAndUpload(request)
 *   window.api.serial.open(request)
 *   window.api.serial.onData(callback)
 *   window.api.ai.generate(request)
 */

import type { IHardwareState } from './hardware'
import type { IAIGenerateRequest, IAIResult } from './ai'
import type {
  IUploadRequest,
  ICompiledFirmware,
  ICompileResult,
  IUploadResult,
  IUploadLogPayload
} from './upload'
import type {
  ISerialOpenRequest,
  ISerialCloseRequest,
  ISerialWriteRequest,
  ISerialDataPayload,
  ISerialStatusPayload,
  ISerialResult
} from './serial'
import type {
  IProjectOpenRequest,
  IProjectOpenResult,
  IProjectOpenDialogResult,
  IProjectSaveRequest,
  IProjectSaveResult,
  IProjectSaveAsRequest,
  IProjectSaveAsResult,
  IProjectDeleteRequest,
  IProjectDeleteResult,
  IProjectAutosaveRequest,
  IProjectSavedPayload,
  IRecentProject
} from './project-persistence'
import type { IWorkspaceInfo } from './workspace'
import type { IAiSettingsConfig, IAiSettingsSaveRequest, ISettingsSaveResult } from './settings'

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
 * compile/upload/compileAndUpload are Renderer → Main invoke calls.
 * log is a Main → Renderer push channel (Phase 10) streaming Integrated
 * Terminal output live — see UploadEventBus.ts and uploadIpcHandlers.ts.
 *
 * Usage (Main):
 *   ipcMain.handle(UploadIpcChannels.compileAndUpload, (_, req) => UploadService.compileAndUpload(req))
 *   mainWindow.webContents.send(UploadIpcChannels.log, payload)
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(UploadIpcChannels.compile, request)
 *   ipcRenderer.on(UploadIpcChannels.log, handler)
 *
 * Usage (Renderer):
 *   window.api.upload.compile(request)
 *   window.api.upload.compileAndUpload(request)
 *   window.api.upload.onLog(callback)
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
  compileAndUpload: 'upload:compileAndUpload' as const,

  /**
   * Main → Renderer (push / one-way).
   * Sent for every command/stdout/stderr chunk produced by a compile or
   * upload subprocess, in real time — never batched until process exit.
   * Renderer subscribes via window.api.upload.onLog().
   */
  log: 'upload:log' as const
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

/**
 * Payload pushed on the upload:log channel.
 */
export type UploadLogPayload = IUploadLogPayload

// ---------------------------------------------------------------------------
// Serial channels
// ---------------------------------------------------------------------------

/**
 * IPC channel names for the serial subsystem.
 *
 * Intentionally separate from HardwareIpcChannels and UploadIpcChannels —
 * serial communication is an independent domain.
 *
 * Invoke channels (Renderer → Main, awaitable response):
 *   serial:open   — opens a port session, returns ISerialResult.
 *   serial:close  — closes a port session, returns ISerialResult.
 *   serial:write  — writes text to an open session, returns ISerialResult.
 *
 * Push channels (Main → Renderer, one-way):
 *   serial:data          — pushed per parsed line from a session.
 *   serial:statusChanged — pushed on every session lifecycle transition.
 *
 * Usage (Main):
 *   ipcMain.handle(SerialIpcChannels.open, (_, req) => SerialService.open(req))
 *   mainWindow.webContents.send(SerialIpcChannels.data, payload)
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(SerialIpcChannels.open, request)
 *   ipcRenderer.on(SerialIpcChannels.data, handler)
 *
 * Usage (Renderer):
 *   window.api.serial.open(request)
 *   window.api.serial.onData(callback)
 */
export const SerialIpcChannels = Object.freeze({
  /**
   * Renderer → Main (invoke).
   * Opens a new serial session on the specified port.
   * Request:  ISerialOpenRequest
   * Response: ISerialResult
   */
  open: 'serial:open' as const,

  /**
   * Renderer → Main (invoke).
   * Closes the active serial session for the specified port.
   * Request:  ISerialCloseRequest
   * Response: ISerialResult
   */
  close: 'serial:close' as const,

  /**
   * Renderer → Main (invoke).
   * Writes text to the active serial session for the specified port.
   * Request:  ISerialWriteRequest
   * Response: ISerialResult
   */
  write: 'serial:write' as const,

  /**
   * Main → Renderer (push / one-way).
   * Sent for every parsed line received from a serial session.
   * One event per line — no batching in V0.1.
   * Renderer subscribes via window.api.serial.onData().
   */
  data: 'serial:data' as const,

  /**
   * Main → Renderer (push / one-way).
   * Sent whenever a session transitions lifecycle state:
   * opened (connected), closed (closed), or error (error).
   * Renderer subscribes via window.api.serial.onStatusChanged().
   */
  statusChanged: 'serial:statusChanged' as const
} as const)

// ---------------------------------------------------------------------------
// Serial payload type aliases
//
// Documentation-only type aliases naming each channel's request and response
// types. Not imported by handlers or preload (which import directly from
// @shared/types/serial) but serve as a clear contract reference.
// ---------------------------------------------------------------------------

/** Request payload for the serial:open invoke channel. */
export type SerialOpenRequest = ISerialOpenRequest

/** Response payload for the serial:open invoke channel. */
export type SerialOpenResult = ISerialResult

/** Request payload for the serial:close invoke channel. */
export type SerialCloseRequest = ISerialCloseRequest

/** Response payload for the serial:close invoke channel. */
export type SerialCloseResult = ISerialResult

/** Request payload for the serial:write invoke channel. */
export type SerialWriteRequest = ISerialWriteRequest

/** Response payload for the serial:write invoke channel. */
export type SerialWriteResult = ISerialResult

/** Payload pushed on the serial:data channel. */
export type SerialDataPayload = ISerialDataPayload

/** Payload pushed on the serial:statusChanged channel. */
export type SerialStatusChangedPayload = ISerialStatusPayload

// ---------------------------------------------------------------------------
// AI channels
// ---------------------------------------------------------------------------

/**
 * IPC channel names for the AI firmware generation subsystem.
 *
 * Intentionally separate from all other channel groups — the AI domain
 * is independent of hardware, upload, and serial.
 *
 * All channels are Renderer → Main invoke calls.
 * No push events are defined in V0.1 (invoke/response pattern only).
 * Streaming responses are deferred to a future performance phase.
 *
 * Usage (Main):
 *   ipcMain.handle(AiIpcChannels.generate, (_, req) => AIService.generate(req))
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(AiIpcChannels.generate, request)
 *
 * Usage (Renderer):
 *   window.api.ai.generate(request)
 */
export const AiIpcChannels = Object.freeze({
  /**
   * Renderer → Main (invoke).
   * Generates firmware from a natural-language prompt.
   * Returns a complete IProjectDocument on success, or a structured error on failure.
   * Request:  IAIGenerateRequest
   * Response: IAIResult
   */
  generate: 'ai:generate' as const
} as const)

// ---------------------------------------------------------------------------
// AI payload type aliases
//
// Documentation-only type aliases naming each channel's request and response
// types. Not imported by handlers or preload (which import directly from
// @shared/types/ai) but serve as a clear contract reference.
// ---------------------------------------------------------------------------

/** Request payload for the ai:generate invoke channel. */
export type AiGenerateRequest = IAIGenerateRequest

/** Response payload for the ai:generate invoke channel. */
export type AiGenerateResult = IAIResult

// ---------------------------------------------------------------------------
// Workspace channels (Phase 7, Slice 28)
// ---------------------------------------------------------------------------

/**
 * IPC channel names for the workspace subsystem.
 *
 * The workspace is the on-disk root directory under which all projects are
 * stored. This is the only channel group registered by projectIpcHandlers.ts
 * in Slice 28 — the project:* channels below are defined now for a complete
 * upfront contract but are wired in their respective later slices.
 *
 * Usage (Main):
 *   ipcMain.handle(WorkspaceIpcChannels.getInfo, () => WorkspaceService.getInfo())
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(WorkspaceIpcChannels.getInfo)
 *
 * Usage (Renderer):
 *   window.api.workspace.getInfo()
 */
export const WorkspaceIpcChannels = Object.freeze({
  /**
   * Renderer → Main (invoke).
   * Returns the resolved, already-created workspace root path.
   * Response: IWorkspaceInfo
   */
  getInfo: 'workspace:info' as const
} as const)

/** Response payload for the workspace:info invoke channel. */
export type WorkspaceGetInfoResult = IWorkspaceInfo

// ---------------------------------------------------------------------------
// Project channels (Phase 7)
//
// Channel-name contract is defined in full here in Slice 28. Only
// workspace:info (above) has a live ipcMain.handle registration in Slice 28.
// Each project:* channel below is registered by projectIpcHandlers.ts in its
// owning slice:
//   save, saveAs   — Slice 30
//   open, recent   — Slice 31
//   autosave, saved — Slice 32
//   delete — Slice 33
//   openDialog — Phase 9, Slice 3
// No stub handlers exist for unregistered channels — calling one before its
// slice lands rejects with Electron's standard "no handler registered" error.
// ---------------------------------------------------------------------------

export const ProjectIpcChannels = Object.freeze({
  /** Renderer → Main (invoke). Request: IProjectOpenRequest. Response: IProjectOpenResult. */
  open: 'project:open' as const,

  /** Renderer → Main (invoke). Request: IProjectSaveRequest. Response: IProjectSaveResult. */
  save: 'project:save' as const,

  /** Renderer → Main (invoke). Request: IProjectSaveAsRequest. Response: IProjectSaveAsResult. */
  saveAs: 'project:saveAs' as const,

  /** Renderer → Main (invoke). Request: IProjectDeleteRequest. Response: IProjectDeleteResult. */
  delete: 'project:delete' as const,

  /** Renderer → Main (invoke). No request payload. Response: IRecentProject[]. */
  recent: 'project:recent' as const,

  /** Renderer → Main (invoke). Request: IProjectAutosaveRequest. Response: IProjectSaveResult. */
  autosave: 'project:autosave' as const,

  /** Main → Renderer (push / one-way). Payload: IProjectSavedPayload. */
  saved: 'project:saved' as const,

  /**
   * Renderer → Main (invoke). No request payload.
   * Response: IProjectOpenDialogResult.
   */
  openDialog: 'project:openDialog' as const
} as const)

// ---------------------------------------------------------------------------
// Project payload type aliases
//
// Documentation-only type aliases naming each channel's request and response
// types. Not imported by handlers or preload (which import directly from
// @shared/types/project-persistence) but serve as a clear contract reference.
// ---------------------------------------------------------------------------

/** Request payload for the project:open invoke channel. */
export type ProjectOpenRequest = IProjectOpenRequest

/** Response payload for the project:open invoke channel. */
export type ProjectOpenResult = IProjectOpenResult

/** Request payload for the project:save invoke channel. */
export type ProjectSaveRequest = IProjectSaveRequest

/** Response payload for the project:save invoke channel. */
export type ProjectSaveResult = IProjectSaveResult

/** Request payload for the project:saveAs invoke channel. */
export type ProjectSaveAsRequest = IProjectSaveAsRequest

/** Response payload for the project:saveAs invoke channel. */
export type ProjectSaveAsResult = IProjectSaveAsResult

/** Request payload for the project:delete invoke channel. */
export type ProjectDeleteRequest = IProjectDeleteRequest

/** Response payload for the project:delete invoke channel. */
export type ProjectDeleteResult = IProjectDeleteResult

/** Request payload for the project:autosave invoke channel. */
export type ProjectAutosaveRequest = IProjectAutosaveRequest

/** Response payload for the project:recent invoke channel. */
export type ProjectRecentResult = IRecentProject[]

/** Payload pushed on the project:saved channel. */
export type ProjectSavedPayload = IProjectSavedPayload

/** Response payload for the project:openDialog invoke channel. */
export type ProjectOpenDialogResult = IProjectOpenDialogResult

// ---------------------------------------------------------------------------
// Settings channels (Phase 8, Slice 35)
// ---------------------------------------------------------------------------

/**
 * IPC channel names for the Settings subsystem.
 *
 * Intentionally separate from AiIpcChannels — the Settings domain is
 * independent of the AI generation domain. Coordination between the two
 * (resolving persisted AI settings for a generation request) happens inside
 * aiIpcHandlers.ts, not via a shared channel group.
 *
 * Both channels are Renderer → Main invoke calls. No push events.
 *
 * Usage (Main):
 *   ipcMain.handle(SettingsIpcChannels.getAiConfig, () => SettingsService.getAiConfig())
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(SettingsIpcChannels.getAiConfig)
 *
 * Usage (Renderer):
 *   window.api.settings.getAiConfig()
 */
export const SettingsIpcChannels = Object.freeze({
  /**
   * Renderer → Main (invoke).
   * Returns the sanitized, Renderer-safe AI provider configuration. Never
   * includes the raw API key.
   * Response: IAiSettingsConfig
   */
  getAiConfig: 'settings:getAiConfig' as const,

  /**
   * Renderer → Main (invoke).
   * Persists the given AI provider configuration.
   * Request:  IAiSettingsSaveRequest
   * Response: ISettingsSaveResult
   */
  saveAiConfig: 'settings:saveAiConfig' as const
} as const)

// ---------------------------------------------------------------------------
// Settings payload type aliases
// ---------------------------------------------------------------------------

/** Response payload for the settings:getAiConfig invoke channel. */
export type SettingsGetAiConfigResult = IAiSettingsConfig

/** Request payload for the settings:saveAiConfig invoke channel. */
export type SettingsSaveAiConfigRequest = IAiSettingsSaveRequest

/** Response payload for the settings:saveAiConfig invoke channel. */
export type SettingsSaveAiConfigResult = ISettingsSaveResult
