import { ElectronAPI } from '@electron-toolkit/preload'
import type { IHardwareState } from '@shared/types/hardware'
import type {
  IUploadRequest,
  ICompiledFirmware,
  ICompileResult,
  IUploadResult
} from '@shared/types/upload'
import type {
  ISerialOpenRequest,
  ISerialCloseRequest,
  ISerialWriteRequest,
  ISerialDataPayload,
  ISerialStatusPayload,
  ISerialResult
} from '@shared/types/serial'
import type { IAIGenerateRequest, IAIResult } from '@shared/types/ai'
import type {
  IProjectOpenRequest,
  IProjectOpenResult,
  IProjectSaveRequest,
  IProjectSaveResult,
  IProjectSaveAsRequest,
  IProjectSaveAsResult,
  IProjectDeleteRequest,
  IProjectDeleteResult,
  IProjectAutosaveRequest,
  IProjectSavedPayload,
  IRecentProject
} from '@shared/types/project-persistence'
import type { IWorkspaceInfo } from '@shared/types/workspace'
import type {
  IAiSettingsConfig,
  IAiSettingsSaveRequest,
  ISettingsSaveResult
} from '@shared/types/settings'

/**
 * IApi
 *
 * The complete type contract for window.api as exposed through the preload bridge.
 *
 * Architectural rules:
 * - This declaration file is the Renderer's view of the preload API.
 * - It mirrors the runtime object in preload/index.ts exactly.
 * - Types are imported from @shared/types — never duplicated.
 * - Future subsystems (serial, ai, project, settings) are added here
 *   alongside their preload implementation, in their respective slices.
 *
 * All types are imported using relative paths because this .d.ts is loaded
 * by tsconfig.web.json which does not have the @shared path alias configured
 * the same way as tsconfig.node.json.
 */
export interface IHardwareApi {
  /**
   * Returns the current IHardwareState snapshot.
   * No side effects — does not trigger a refresh.
   */
  getState: () => Promise<IHardwareState>

  /**
   * Returns the latest IHardwareState.
   * Reserved for future user-initiated refresh actions.
   */
  refresh: () => Promise<IHardwareState>

  /**
   * Subscribes to hardware state push events from the Main process.
   *
   * The callback is invoked whenever the hardware layer detects a change
   * (port connected/disconnected, CLI state updated, identification completed).
   *
   * @returns An unsubscribe function. Call it in useEffect cleanup.
   */
  onStateChanged: (callback: (state: IHardwareState) => void) => () => void
}

export interface IUploadApi {
  /**
   * Compiles firmware source using arduino-cli.
   * Returns a compiled firmware artifact on success.
   * The artifact must be passed to upload() to complete the pipeline
   * and trigger cleanup of the temporary build directory.
   */
  compile: (request: IUploadRequest) => Promise<ICompileResult>

  /**
   * Uploads a previously compiled firmware artifact to the target port.
   * The artifact is spent after this call — do not reuse it.
   */
  upload: (firmware: ICompiledFirmware) => Promise<IUploadResult>

  /**
   * Compiles firmware source then uploads to the board in a single call.
   * Stops and returns the compile error if compilation fails.
   * Primary entry point for the one-click upload workflow in V0.1.
   */
  compileAndUpload: (request: IUploadRequest) => Promise<IUploadResult>
}

export interface ISerialApi {
  /**
   * Opens a new serial session on the specified port with the given settings.
   * Returns { status: 'success' } on success or a typed error on failure.
   */
  open: (request: ISerialOpenRequest) => Promise<ISerialResult>

  /**
   * Closes the active serial session for the specified port.
   * Returns { status: 'success' } on success or a typed error if not open.
   */
  close: (request: ISerialCloseRequest) => Promise<ISerialResult>

  /**
   * Writes text to the active serial session for the specified port.
   * The newline setting from request.newline is applied in the Main process.
   * Returns { status: 'success' } on success or a typed error on failure.
   */
  write: (request: ISerialWriteRequest) => Promise<ISerialResult>

  /**
   * Subscribes to serial:data push events from the Main process.
   * Called once per parsed line from any active serial session.
   * The payload includes the port path for per-port routing in the store.
   * @returns An unsubscribe function. Call it in useEffect cleanup.
   */
  onData: (callback: (payload: ISerialDataPayload) => void) => () => void

  /**
   * Subscribes to serial:statusChanged push events from the Main process.
   * Called whenever a session transitions lifecycle state.
   * @returns An unsubscribe function. Call it in useEffect cleanup.
   */
  onStatusChanged: (callback: (payload: ISerialStatusPayload) => void) => () => void
}

export interface IAiApi {
  /**
   * Generates firmware from a natural-language prompt.
   *
   * Sends IAIGenerateRequest to the Main process via the ai:generate invoke channel.
   * AIService orchestrates the full pipeline: PromptBuilder → AIClient →
   * ResponseParser → ResponseValidator → IProjectDocument.
   *
   * On success: IAIResult { status: 'success', project: IProjectDocument }.
   *   The project is a fully constructed, immutable IProjectDocument. The
   *   Zustand store holds it as a pendingAiCandidate awaiting explicit
   *   Accept/Discard (Phase 8, Slice 36) — it is never written directly to
   *   currentProjectDoc by this call.
   *
   * On error: IAIResult { status: 'error', code: AIErrorCode, error: string }.
   *   The code identifies the error category for UI branching without string parsing.
   *   The error message is user-friendly and safe to display directly.
   *
   * Never rejects — all outcomes are returned as typed IAIResult values.
   * The Renderer does not need a try/catch around this call.
   */
  generate: (request: IAIGenerateRequest) => Promise<IAIResult>
}

export interface IWorkspaceApi {
  /**
   * Returns the resolved, already-created workspace root path
   * (e.g. "C:\Users\<user>\Documents\IoTOS AI Projects").
   */
  getInfo: () => Promise<IWorkspaceInfo>
}

export interface IProjectApi {
  /**
   * Opens a project file from disk and reconstructs it into an
   * IProjectDocument. No live handler exists until Slice 31 — calling this
   * before then rejects with Electron's standard "no handler registered"
   * error.
   */
  open: (request: IProjectOpenRequest) => Promise<IProjectOpenResult>

  /**
   * Saves the given document to filePath. No live handler exists until
   * Slice 30.
   */
  save: (request: IProjectSaveRequest) => Promise<IProjectSaveResult>

  /**
   * Saves the given document to a user-chosen path via a native dialog. No
   * live handler exists until Slice 30.
   */
  saveAs: (request: IProjectSaveAsRequest) => Promise<IProjectSaveAsResult>

  /**
   * Deletes a project file and its recents entry. No live handler exists
   * until Slice 33.
   */
  delete: (request: IProjectDeleteRequest) => Promise<IProjectDeleteResult>

  /**
   * Returns the full recent-projects registry. No live handler exists until
   * Slice 31.
   */
  getRecent: () => Promise<IRecentProject[]>

  /**
   * Autosaves the given document to its existing path. No live handler
   * exists until Slice 32.
   */
  autosave: (request: IProjectAutosaveRequest) => Promise<IProjectSaveResult>

  /**
   * Subscribes to project:saved push events from the Main process, sent
   * after a successful autosave. No handler ever sends this event until
   * Slice 32 — the callback simply never fires until then.
   * @returns An unsubscribe function. Call it in useEffect cleanup.
   */
  onSaved: (callback: (payload: IProjectSavedPayload) => void) => () => void
}

export interface ISettingsApi {
  /**
   * Returns the sanitized, Renderer-safe AI provider configuration.
   * Never includes the raw API key — only hasApiKey.
   */
  getAiConfig: () => Promise<IAiSettingsConfig>

  /**
   * Persists the given AI provider configuration.
   * Returns { status: 'success' } on success or a typed error on failure.
   * See IAiSettingsSaveRequest.apiKey's doc comment for its
   * unchanged/clear/set semantics.
   */
  saveAiConfig: (request: IAiSettingsSaveRequest) => Promise<ISettingsSaveResult>
}

export interface IApi {
  hardware: IHardwareApi
  upload: IUploadApi
  serial: ISerialApi
  ai: IAiApi
  project: IProjectApi
  workspace: IWorkspaceApi
  settings: ISettingsApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
