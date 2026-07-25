/**
 * Serial IPC Handlers
 *
 * Registers all ipcMain handlers for the serial subsystem and manages the
 * push channels that forward SerialEventBus events to the Renderer.
 *
 * Architectural rules:
 * - Completely separate from hardwareIpcHandlers.ts and uploadIpcHandlers.ts.
 *   Serial communication, hardware detection, and firmware upload are
 *   independent domains.
 * - This module owns the boundary between the Main process and the serial IPC layer.
 * - It NEVER accesses SerialService or SerialSession internals directly —
 *   it delegates to the three public methods: open(), close(), write().
 * - It performs NO business logic. It is a thin, typed delegation layer only.
 * - It does NOT transform SerialService results. Typed results cross the bridge
 *   exactly as returned — errors included.
 * - It never throws across the IPC boundary. SerialService already returns typed
 *   error results instead of throwing, so no try/catch is needed in handlers.
 * - Push events use webContents.send() guarded against destroyed windows, matching
 *   the same safety pattern as hardwareIpcHandlers.ts.
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to remove handlers on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   serial:open   → SerialService.open(request)
 *   serial:close  → SerialService.close(request.port)
 *   serial:write  → SerialService.write(request.port, request.text, request.newline)
 *
 * Push channels driven here (Main → Renderer):
 *   serial:data          → sent on every SerialEventBus 'serial:line' event
 *   serial:statusChanged → sent on every SerialEventBus 'serial:statusChanged' event
 *
 * Lifecycle:
 *   serialIpcHandlers.register(mainWindow) — called once after app is ready.
 *   serialIpcHandlers.remove()             — called on app quit or window close.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { SerialService } from '../serial/SerialService'
import { SerialEventBus } from '../serial/SerialEventBus'
import { SerialIpcChannels } from '@shared/types/ipc'
import type {
  ISerialOpenRequest,
  ISerialCloseRequest,
  ISerialWriteRequest,
  ISerialDataPayload,
  ISerialStatusPayload
} from '@shared/types/serial'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Cached reference to the main BrowserWindow, used to send push events. */
let _mainWindow: BrowserWindow | null = null

/**
 * The listener registered on SerialEventBus('serial:line').
 * Stored for precise removal during teardown — avoids removeAllListeners()
 * which would discard other internal subscribers.
 */
let _lineListener: ((payload: ISerialDataPayload) => void) | null = null

/**
 * The listener registered on SerialEventBus('serial:statusChanged').
 * Stored for precise removal during teardown.
 */
let _statusChangedListener: ((payload: ISerialStatusPayload) => void) | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends the serial:data push event to the Renderer if the window still exists
 * and its webContents have not been destroyed.
 *
 * Guard conditions mirror hardwareIpcHandlers.ts:
 * - Window reference must be non-null (set during registration).
 * - webContents must not have been destroyed (guards against race conditions
 *   that can occur when a data event fires just after window close).
 */
function pushDataToRenderer(payload: ISerialDataPayload): void {
  if (_mainWindow && !_mainWindow.webContents.isDestroyed()) {
    _mainWindow.webContents.send(SerialIpcChannels.data, payload)
  }
}

/**
 * Sends the serial:statusChanged push event to the Renderer.
 * Same guard conditions as pushDataToRenderer.
 */
function pushStatusToRenderer(payload: ISerialStatusPayload): void {
  if (_mainWindow && !_mainWindow.webContents.isDestroyed()) {
    _mainWindow.webContents.send(SerialIpcChannels.statusChanged, payload)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the serial subsystem.
 *
 * Must be called exactly once, after the BrowserWindow has been created.
 * Subscribes to SerialEventBus so that push events are forwarded to the
 * Renderer as soon as any serial session emits data or changes state.
 *
 * @param mainWindow - The application's primary BrowserWindow. Required to
 *   send push events (serial:data, serial:statusChanged) to the Renderer.
 */
function registerSerialIpcHandlers(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow

  // -------------------------------------------------------------------------
  // Invoke: serial:open
  //
  // Opens a new serial session on the requested port.
  // Returns { status: 'success' } on success.
  // Returns { status: 'error', code, error } if the port is already open,
  // not found, permission-denied, or busy.
  //
  // Response: ISerialResult
  // -------------------------------------------------------------------------
  ipcMain.handle(SerialIpcChannels.open, (_event, request: ISerialOpenRequest) => {
    return SerialService.open(request)
  })

  // -------------------------------------------------------------------------
  // Invoke: serial:close
  //
  // Closes the active serial session for the specified port.
  // Returns { status: 'success' } on success.
  // Returns { status: 'error', code, error } if no session is active.
  //
  // Response: ISerialResult
  // -------------------------------------------------------------------------
  ipcMain.handle(SerialIpcChannels.close, (_event, request: ISerialCloseRequest) => {
    return SerialService.close(request.port)
  })

  // -------------------------------------------------------------------------
  // Invoke: serial:write
  //
  // Writes text to the active serial session for the specified port.
  // Appends the newline terminator from request.newline before sending.
  // Returns { status: 'success' } on success.
  // Returns { status: 'error', code, error } if the port is not open or the
  // write fails.
  //
  // Response: ISerialResult
  // -------------------------------------------------------------------------
  ipcMain.handle(SerialIpcChannels.write, (_event, request: ISerialWriteRequest) => {
    return SerialService.write(request.port, request.text, request.newline)
  })

  // -------------------------------------------------------------------------
  // Push: serial:data
  //
  // Subscribe to the internal SerialEventBus 'serial:line' event and forward
  // it to the Renderer via webContents.send(). This makes the Renderer
  // reactive to incoming data without polling from the UI.
  //
  // One event per parsed line — no batching in V0.1.
  // -------------------------------------------------------------------------
  _lineListener = (payload: ISerialDataPayload) => {
    pushDataToRenderer(payload)
  }

  SerialEventBus.on('serial:line', _lineListener)

  // -------------------------------------------------------------------------
  // Push: serial:statusChanged
  //
  // Subscribe to SerialEventBus 'serial:statusChanged' events and forward
  // them to the Renderer. The Renderer uses these to update connection state
  // in the Zustand store (Slice 16) and the UI (Slice 17).
  // -------------------------------------------------------------------------
  _statusChangedListener = (payload: ISerialStatusPayload) => {
    pushStatusToRenderer(payload)
  }

  SerialEventBus.on('serial:statusChanged', _statusChangedListener)
}

/**
 * Removes all ipcMain handlers and SerialEventBus listeners registered by
 * this module.
 *
 * Must be called when the application is quitting or the window is closing.
 * Also triggers SerialService.closeAll() to release all open OS port handles
 * before the process exits, preventing resource leaks.
 */
function removeSerialIpcHandlers(): void {
  ipcMain.removeHandler(SerialIpcChannels.open)
  ipcMain.removeHandler(SerialIpcChannels.close)
  ipcMain.removeHandler(SerialIpcChannels.write)

  if (_lineListener) {
    SerialEventBus.off('serial:line', _lineListener)
    _lineListener = null
  }

  if (_statusChangedListener) {
    SerialEventBus.off('serial:statusChanged', _statusChangedListener)
    _statusChangedListener = null
  }

  // Release all open port handles — this is best-effort; errors are suppressed
  // inside closeAll() so they cannot delay the shutdown sequence.
  SerialService.closeAll().catch(() => {
    // Intentionally suppressed — teardown must always complete
  })

  _mainWindow = null
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const serialIpcHandlers = Object.freeze({
  register: registerSerialIpcHandlers,
  remove: removeSerialIpcHandlers
})
