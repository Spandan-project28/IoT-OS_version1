/**
 * SerialPortService
 *
 * Responsible for discovering and tracking physical OS serial ports.
 *
 * Architectural rules:
 * - Single responsibility: port enumeration and change detection only.
 * - Owns its internal port list state. HardwareManager reads this state.
 * - Never identifies boards — that is BoardIdentificationService's responsibility.
 * - Never communicates with the Renderer, IPC, or UI.
 * - Uses polling via SerialPort.list() for maximum cross-platform reliability.
 * - Emits change notifications via a registered callback (not EventEmitter yet —
 *   HardwareEventBus is introduced in Slice 4).
 * - Never opens ports for reading/writing — that belongs to SerialService (Phase 4).
 *
 * Polling design rationale:
 *   Native USB hotplug (usb-detection) requires deeply native bindings and causes
 *   frequent Electron ABI rebuild failures on Windows. SerialPort.list() uses the
 *   Windows registry / WMI and does not require native compilation for listing.
 *   A 2-second polling interval is lightweight and provides timely detection.
 *
 * Future consumers:
 * - HardwareManager      (reads port list to assemble IHardwareState snapshots)
 * - BoardIdentificationService (receives port list to identify boards)
 * - HardwareEventBus     (notified via onPortsChanged callback, Slice 4)
 */

import { SerialPort } from 'serialport'
import type { ISerialPort } from '@shared/types/hardware'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often (ms) the port list is re-queried from the OS. */
const POLL_INTERVAL_MS = 2000

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** The most recently discovered list of serial ports. */
let _ports: ISerialPort[] = []

/** Reference to the active polling interval, or null when stopped. */
let _pollInterval: ReturnType<typeof setInterval> | null = null

/**
 * Optional callback registered by the caller (HardwareManager in Slice 4).
 * Invoked with the new port list whenever a change is detected.
 */
let _onChangeCallback: ((ports: ISerialPort[]) => void) | null = null

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a raw PortInfo entry from serialport into our ISerialPort shape.
 * The serialport library uses camelCase keys; we keep the same convention
 * to align with ISerialPort without renaming.
 */
function normalisePort(raw: Awaited<ReturnType<typeof SerialPort.list>>[number]): ISerialPort {
  return {
    path: raw.path,
    vendorId: raw.vendorId,
    productId: raw.productId,
    manufacturer: raw.manufacturer
  }
}

/**
 * Returns true if two port lists differ in composition.
 * Comparison is by port path only — sufficient for add/remove detection.
 */
function hasPortListChanged(prev: ISerialPort[], next: ISerialPort[]): boolean {
  if (prev.length !== next.length) return true
  const prevPaths = new Set(prev.map((p) => p.path))
  return next.some((p) => !prevPaths.has(p.path))
}

/**
 * Queries the OS for the current list of serial ports and updates internal state.
 * If the list has changed, notifies the registered callback.
 */
async function poll(): Promise<void> {
  try {
    const raw = await SerialPort.list()
    const next = raw.map(normalisePort)

    if (hasPortListChanged(_ports, next)) {
      _ports = next
      if (_onChangeCallback) {
        _onChangeCallback([..._ports])
      }
    }
  } catch {
    // Polling errors are intentionally swallowed.
    // The stale port list is preserved — a transient OS error does not
    // falsely report all boards as disconnected.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers a callback to be invoked when the port list changes.
 * Only one callback is supported — designed for HardwareManager (Slice 4).
 *
 * Call this before startPolling() to ensure no changes are missed.
 *
 * @param callback - Receives the updated port list on every detected change.
 */
function onPortsChanged(callback: (ports: ISerialPort[]) => void): void {
  _onChangeCallback = callback
}

/**
 * Starts the periodic port-discovery polling loop.
 *
 * Performs an immediate first poll so callers receive an initial state
 * without waiting for the first interval to elapse.
 *
 * Calling startPolling() when already polling is a no-op.
 */
async function startPolling(): Promise<void> {
  if (_pollInterval !== null) return

  // Immediate first scan
  await poll()

  _pollInterval = setInterval(() => {
    poll().catch(() => {
      // poll() itself catches all errors; this .catch() is a safety net
      // for any unexpected promise rejection that escaped poll().
    })
  }, POLL_INTERVAL_MS)
}

/**
 * Stops the polling loop and clears internal state.
 * Safe to call when polling has not been started.
 */
function stopPolling(): void {
  if (_pollInterval !== null) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
}

/**
 * Returns a shallow copy of the most recently discovered port list.
 * Returns an empty array if polling has never been started.
 */
function getPorts(): ISerialPort[] {
  return [..._ports]
}

/**
 * Returns true if the polling loop is currently active.
 */
function isPolling(): boolean {
  return _pollInterval !== null
}

/**
 * Performs a single immediate port scan outside the regular polling interval.
 *
 * Used by HardwareManager.refresh() to force an out-of-cycle re-scan when
 * the Renderer explicitly requests updated hardware state.
 *
 * This method is safe to call regardless of whether polling is active.
 * It does not disturb the existing interval timer.
 */
async function pollNow(): Promise<void> {
  await poll()
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const SerialPortService = Object.freeze({
  onPortsChanged,
  startPolling,
  stopPolling,
  getPorts,
  isPolling,
  pollNow
})
