import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { HardwareIpcChannels, UploadIpcChannels, SerialIpcChannels } from '@shared/types/ipc'
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

// ---------------------------------------------------------------------------
// Hardware API
//
// Exposes a minimal, typed bridge for the hardware subsystem.
//
// Architectural rules:
// - This bridge ONLY wraps ipcRenderer calls. No business logic lives here.
// - The Renderer never imports Electron directly — all IPC passes through this bridge.
// - Listener registration returns an unsubscribe function so callers can
//   clean up without knowing internal ipcRenderer channel names.
// - All types flow from @shared/types — preload imports them from there,
//   the Renderer imports them through the window.api type declaration.
//
// Channels:
//   hardware.getState()             — invoke hardware:getState
//   hardware.refresh()              — invoke hardware:refresh
//   hardware.onStateChanged(cb)     — subscribe to hardware:stateChanged push events
//                                     returns () => void unsubscribe function
// ---------------------------------------------------------------------------

const hardwareApi = {
  /**
   * Returns the current IHardwareState snapshot from the Main process.
   * No side effects — does not trigger a refresh cycle.
   */
  getState: (): Promise<IHardwareState> =>
    ipcRenderer.invoke(HardwareIpcChannels.getState) as Promise<IHardwareState>,

  /**
   * Fetches the latest IHardwareState from the Main process.
   * Reserved for user-initiated refresh actions in a future phase.
   */
  refresh: (): Promise<IHardwareState> =>
    ipcRenderer.invoke(HardwareIpcChannels.refresh) as Promise<IHardwareState>,

  /**
   * Subscribes to hardware state change push events from the Main process.
   *
   * The Main process calls webContents.send(hardware:stateChanged, state)
   * whenever HardwareManager emits a hardwareStateChanged event.
   *
   * @param callback - Called with the updated IHardwareState on each push.
   * @returns An unsubscribe function. Call it in useEffect cleanup to avoid
   *   stale listeners accumulating across component mounts.
   */
  onStateChanged: (callback: (state: IHardwareState) => void): (() => void) => {
    // Wrap callback to extract the payload from the IPC event envelope.
    const handler = (_event: Electron.IpcRendererEvent, state: IHardwareState): void => {
      callback(state)
    }

    ipcRenderer.on(HardwareIpcChannels.stateChanged, handler)

    // Return unsubscribe function — the caller is responsible for invoking it.
    return () => {
      ipcRenderer.removeListener(HardwareIpcChannels.stateChanged, handler)
    }
  }
}

// ---------------------------------------------------------------------------
// Upload API
//
// Exposes a minimal, typed bridge for the upload subsystem.
//
// Architectural rules:
// - Thin bridge only — no business logic.
// - All three methods are invoke/response (no push events in this slice).
// - Types flow from @shared/types/upload — no duplication.
//
// Channels:
//   upload.compile(request)              — invoke upload:compile
//   upload.upload(firmware)              — invoke upload:upload
//   upload.compileAndUpload(request)     — invoke upload:compileAndUpload
// ---------------------------------------------------------------------------

const uploadApi = {
  /**
   * Compiles firmware source and returns a compiled artifact on success.
   * The ICompiledFirmware artifact must be passed to upload() to complete
   * the pipeline and trigger cleanup of the temporary build directory.
   */
  compile: (request: IUploadRequest): Promise<ICompileResult> =>
    ipcRenderer.invoke(UploadIpcChannels.compile, request) as Promise<ICompileResult>,

  /**
   * Uploads a previously compiled firmware artifact to the target port.
   * The artifact is spent after this call — do not reuse it.
   */
  upload: (firmware: ICompiledFirmware): Promise<IUploadResult> =>
    ipcRenderer.invoke(UploadIpcChannels.upload, firmware) as Promise<IUploadResult>,

  /**
   * Convenience method: compiles then uploads in a single call.
   * Stops and returns the compile error if compilation fails.
   * Primary entry point for the one-click upload workflow in V0.1.
   */
  compileAndUpload: (request: IUploadRequest): Promise<IUploadResult> =>
    ipcRenderer.invoke(UploadIpcChannels.compileAndUpload, request) as Promise<IUploadResult>
}

// ---------------------------------------------------------------------------
// Serial API
//
// Exposes a minimal, typed bridge for the serial subsystem.
//
// Architectural rules:
// - Thin bridge only — no business logic.
// - open/close/write are invoke/response channels.
// - onData and onStatusChanged subscribe to push channels and return
//   unsubscribe functions, exactly like hardware.onStateChanged().
// - Types flow from @shared/types/serial — no duplication.
//
// Channels:
//   serial.open(request)              — invoke serial:open
//   serial.close(request)             — invoke serial:close
//   serial.write(request)             — invoke serial:write
//   serial.onData(cb)                 — subscribe to serial:data push events
//                                       returns () => void unsubscribe function
//   serial.onStatusChanged(cb)        — subscribe to serial:statusChanged push events
//                                       returns () => void unsubscribe function
// ---------------------------------------------------------------------------

const serialApi = {
  /**
   * Opens a new serial session on the specified port with the given settings.
   * Returns { status: 'success' } on success or a typed error on failure.
   */
  open: (request: ISerialOpenRequest): Promise<ISerialResult> =>
    ipcRenderer.invoke(SerialIpcChannels.open, request) as Promise<ISerialResult>,

  /**
   * Closes the active serial session for the specified port.
   * Returns { status: 'success' } on success or a typed error if not open.
   */
  close: (request: ISerialCloseRequest): Promise<ISerialResult> =>
    ipcRenderer.invoke(SerialIpcChannels.close, request) as Promise<ISerialResult>,

  /**
   * Writes text to the active serial session for the specified port.
   * The newline setting from request.newline is applied in the Main process.
   * Returns { status: 'success' } on success or a typed error on failure.
   */
  write: (request: ISerialWriteRequest): Promise<ISerialResult> =>
    ipcRenderer.invoke(SerialIpcChannels.write, request) as Promise<ISerialResult>,

  /**
   * Subscribes to serial:data push events from the Main process.
   *
   * Called once per parsed line from any active serial session.
   * The payload includes the port path so the Renderer can route the line
   * to the correct per-port log store.
   *
   * @param callback - Called with ISerialDataPayload on each push.
   * @returns An unsubscribe function. Call it in useEffect cleanup.
   */
  onData: (callback: (payload: ISerialDataPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ISerialDataPayload): void => {
      callback(payload)
    }
    ipcRenderer.on(SerialIpcChannels.data, handler)
    return () => {
      ipcRenderer.removeListener(SerialIpcChannels.data, handler)
    }
  },

  /**
   * Subscribes to serial:statusChanged push events from the Main process.
   *
   * Called whenever a session transitions lifecycle state:
   * opened (connected), closed (closed), or error (error).
   *
   * @param callback - Called with ISerialStatusPayload on each push.
   * @returns An unsubscribe function. Call it in useEffect cleanup.
   */
  onStatusChanged: (callback: (payload: ISerialStatusPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ISerialStatusPayload): void => {
      callback(payload)
    }
    ipcRenderer.on(SerialIpcChannels.statusChanged, handler)
    return () => {
      ipcRenderer.removeListener(SerialIpcChannels.statusChanged, handler)
    }
  }
}

// ---------------------------------------------------------------------------
// Composed API surface
//
// All future subsystems (ai, project, settings) will be added here as
// additional namespaced objects when their IPC slices are implemented.
// ---------------------------------------------------------------------------

const api = {
  hardware: hardwareApi,
  upload: uploadApi,
  serial: serialApi
}

// ---------------------------------------------------------------------------
// Context bridge
//
// Expose the API object to the Renderer via contextBridge.
// If context isolation is disabled (development edge case), fall back to direct
// window assignment — this mirrors the electron-vite scaffold convention.
// ---------------------------------------------------------------------------

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
