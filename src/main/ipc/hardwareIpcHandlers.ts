/**
 * Hardware IPC Handlers
 *
 * Registers all ipcMain handlers for the hardware subsystem and manages the
 * push channel that forwards HardwareEventBus events to the Renderer.
 *
 * Architectural rules:
 * - This module owns the boundary between the Main process and the IPC layer.
 * - It NEVER touches serial ports, Arduino CLI, or board identification directly.
 *   All hardware access is delegated to HardwareManager.
 * - It translates HardwareEventBus internal events into IPC pushes.
 * - It does NOT communicate with the Renderer directly from within handlers —
 *   it returns data or sends via webContents, never via ipcMain.emit().
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to clean up listeners on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   hardware:getState  → HardwareManager.getState()
 *   hardware:refresh   → HardwareManager.getState() (re-identification is
 *                        triggered automatically by the polling interval;
 *                        this channel returns the latest assembled snapshot)
 *
 * Push channels driven here (Main → Renderer):
 *   hardware:stateChanged → sent whenever HardwareEventBus fires
 *                           'hardwareStateChanged'
 *
 * Lifecycle:
 *   registerHardwareIpcHandlers(mainWindow) — called once after app is ready.
 *   removeHardwareIpcHandlers()             — called on app quit or window close.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { HardwareManager } from '../hardware/HardwareManager'
import { HardwareEventBus } from '../hardware/HardwareEventBus'
import { HardwareIpcChannels } from '@shared/types/ipc'
import type { IHardwareState } from '@shared/types/hardware'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Cached reference to the main BrowserWindow, used to send push events. */
let _mainWindow: BrowserWindow | null = null

/**
 * The listener registered on HardwareEventBus('hardwareStateChanged').
 * Stored so it can be removed precisely during teardown without calling
 * removeAllListeners() (which would discard other internal subscribers).
 */
let _stateChangedListener: ((state: IHardwareState) => void) | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends the hardware:stateChanged push event to the Renderer if the window
 * still exists and its webContents have not been destroyed.
 *
 * Guard conditions:
 * - Window reference must be non-null (set during registration).
 * - webContents must not have been destroyed (guards against race conditions
 *   that can occur when a state change fires just after window close).
 */
function pushStateToRenderer(state: IHardwareState): void {
  if (_mainWindow && !_mainWindow.webContents.isDestroyed()) {
    _mainWindow.webContents.send(HardwareIpcChannels.stateChanged, state)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the hardware subsystem.
 *
 * Must be called exactly once, after the BrowserWindow has been created and
 * HardwareManager has been initialized and started.
 *
 * @param mainWindow - The application's primary BrowserWindow. Required to
 *   send push events (hardware:stateChanged) to the Renderer.
 */
function registerHardwareIpcHandlers(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow

  // -------------------------------------------------------------------------
  // Invoke: hardware:getState
  //
  // Returns the current IHardwareState snapshot assembled from all services.
  // This call has no side effects — it does not trigger a refresh.
  // -------------------------------------------------------------------------
  ipcMain.handle(HardwareIpcChannels.getState, (): IHardwareState => {
    return HardwareManager.getState()
  })

  // -------------------------------------------------------------------------
  // Invoke: hardware:refresh
  //
  // Forces a full out-of-cycle hardware re-scan:
  //   1. Re-queries Arduino CLI (version + installed cores)
  //   2. Performs an immediate SerialPort.list() poll outside the 2s interval
  //   3. Re-runs board identification against the fresh port list
  //   4. Emits hardwareStateChanged via HardwareEventBus (push to Renderer)
  //   5. Returns the updated IHardwareState snapshot
  //
  // Intended for user-initiated "Scan again" actions. The hardwareStateChanged
  // push event fires automatically as a side effect of step 3, so the Renderer
  // receives the update through both channels simultaneously.
  // -------------------------------------------------------------------------
  ipcMain.handle(HardwareIpcChannels.refresh, async (): Promise<IHardwareState> => {
    return HardwareManager.refresh()
  })

  // -------------------------------------------------------------------------
  // Push: hardware:stateChanged
  //
  // Subscribe to the internal HardwareEventBus event and forward it to the
  // Renderer via webContents.send(). This makes the Renderer reactive to
  // hardware changes without polling from the UI.
  // -------------------------------------------------------------------------
  _stateChangedListener = (state: IHardwareState) => {
    pushStateToRenderer(state)
  }

  HardwareEventBus.on('hardwareStateChanged', _stateChangedListener)
}

/**
 * Removes all ipcMain handlers and EventBus listeners registered by this module.
 *
 * Must be called when the application is quitting or the window is closing to
 * prevent stale listeners from accumulating across hot-reloads in development.
 */
function removeHardwareIpcHandlers(): void {
  ipcMain.removeHandler(HardwareIpcChannels.getState)
  ipcMain.removeHandler(HardwareIpcChannels.refresh)

  if (_stateChangedListener) {
    HardwareEventBus.off('hardwareStateChanged', _stateChangedListener)
    _stateChangedListener = null
  }

  _mainWindow = null
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const hardwareIpcHandlers = Object.freeze({
  register: registerHardwareIpcHandlers,
  remove: removeHardwareIpcHandlers
})
