import { ElectronAPI } from '@electron-toolkit/preload'
import type { IHardwareState } from '@shared/types/hardware'

/**
 * IApi
 *
 * The complete type contract for window.api as exposed through the preload bridge.
 *
 * Architectural rules:
 * - This declaration file is the Renderer's view of the preload API.
 * - It mirrors the runtime object in preload/index.ts exactly.
 * - Types are imported from @shared/types — never duplicated.
 * - Future subsystems (upload, serial, ai, project, settings) are added here
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

export interface IApi {
  hardware: IHardwareApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
