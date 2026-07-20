/**
 * IPC Contracts
 *
 * This file is the single source of truth for every IPC channel that crosses
 * the Main ↔ Renderer boundary for the hardware subsystem.
 *
 * Architectural rules:
 * - Channel names are string literals, not enums, so they can be used directly
 *   with ipcMain.handle() and ipcRenderer.invoke() without an extra lookup.
 * - Payload types mirror the domain types from @shared/types/hardware exactly.
 *   No data transformation is performed at the IPC layer.
 * - Invoke channels (Renderer → Main, awaitable response):
 *     hardware:getState  — returns the current IHardwareState snapshot.
 *     hardware:refresh   — forces a CLI refresh + re-identification cycle and
 *                          returns the updated IHardwareState snapshot.
 * - Push channels (Main → Renderer, one-way):
 *     hardware:stateChanged — pushed by the Main process whenever
 *                             HardwareManager emits hardwareStateChanged.
 *
 * Scope:
 * - Phase 2, Slice 5 introduces only the hardware channels.
 * - Future phases will add upload:*, serial:*, ai:*, project:*, settings:*
 *   channels in their respective slices.
 *
 * Usage (Main):
 *   ipcMain.handle(HardwareIpcChannels.getState, () => HardwareManager.getState())
 *
 * Usage (Preload):
 *   ipcRenderer.invoke(HardwareIpcChannels.getState)
 *   ipcRenderer.on(HardwareIpcChannels.stateChanged, callback)
 *
 * Usage (Renderer):
 *   window.api.hardware.getState()
 *   window.api.hardware.onStateChanged(callback)
 */

import type { IHardwareState } from './hardware'

// ---------------------------------------------------------------------------
// Channel name constants
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
// Payload types
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
