import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { HardwareIpcChannels } from '@shared/types/ipc'
import type { IHardwareState } from '@shared/types/hardware'

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
// Composed API surface
//
// All future subsystems (upload, serial, ai, project, settings) will be added
// here as additional namespaced objects when their IPC slices are implemented.
// ---------------------------------------------------------------------------

const api = {
  hardware: hardwareApi
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
