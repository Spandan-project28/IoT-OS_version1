/**
 * HardwareManager
 *
 * The pure orchestrator of the Hardware Abstraction Layer (HAL).
 *
 * Architectural rules:
 * - PURE ORCHESTRATOR. It coordinates services; it does not replace them.
 * - It DOES NOT duplicate service state. Every piece of information comes from a service.
 * - It DOES NOT perform serial port logic, board identification logic, or CLI execution.
 * - It DOES NOT communicate with the Renderer or IPC directly (that is Slice 5's job).
 * - It manages the lifecycle of all hardware services (start / stop).
 * - It assembles IHardwareState snapshots on demand by querying each service.
 * - It coordinates event flow via HardwareEventBus.
 * - selectedBoardId is always null in this slice — board selection is introduced
 *   in Slice 5 (IPC) + Slice 6 (Zustand) + Slice 7 (UI) via the complete
 *   UI → Zustand → IPC → HardwareManager request flow.
 *
 * Dependency injection:
 * - Services are injected via initialize() rather than imported directly.
 * - This decouples HardwareManager from concrete service implementations and
 *   enables future testing with mock services.
 *
 * Lifecycle:
 *   initialize() → start() → [running] → stop() → [stopped]
 *
 * Future integrations:
 * - Slice 5: IPC handlers will call getState() and listen to
 *   HardwareEventBus('hardwareStateChanged') to push updates to the Renderer.
 * - Phase 3: UploadService will call getState() to retrieve the selected board's
 *   FQBN and port before initiating a firmware upload.
 * - Phase 4: SerialService will subscribe to HardwareEventBus('portsChanged')
 *   to detect when a monitored port disconnects and gracefully close its stream.
 */

import { ArduinoCLIService } from './ArduinoCLIService'
import { SerialPortService } from './SerialPortService'
import { BoardIdentificationService } from './BoardIdentificationService'
import { HardwareEventBus } from './HardwareEventBus'
import type { IHardwareState } from '@shared/types/hardware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The set of services managed by HardwareManager.
 * Declared as a type to support dependency injection — the manager
 * depends on the service shape (interface), not the concrete module.
 */
type HardwareServices = {
  readonly cli: typeof ArduinoCLIService
  readonly ports: typeof SerialPortService
  readonly identification: typeof BoardIdentificationService
}

// ---------------------------------------------------------------------------
// Private module state
// ---------------------------------------------------------------------------

/** Injected service references. Populated by initialize(). */
let _services: HardwareServices | null = null

/** Tracks whether start() has been called and stop() has not yet been called. */
let _running = false

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function assembleSnapshot(): IHardwareState {
  if (!_services) {
    throw new Error('HardwareManager: assembleSnapshot() called before initialize()')
  }

  const cli = _services.cli.getState()
  const ports = _services.ports.getPorts()
  const connectedBoards = _services.identification.getIdentifiedBoards()

  return {
    cli,
    ports,
    connectedBoards,
    // selectedBoardId is deferred to Slice 5 (IPC) + Slice 6 (Zustand) + Slice 7 (UI).
    // Board selection requires a complete UI → Zustand → IPC → HardwareManager
    // request flow that does not yet exist. It is always null in this slice.
    selectedBoardId: null,
    isScanning: _services.ports.isPolling(),
    lastScanTimestamp: Date.now()
  }
}

/**
 * Runs a full identification cycle and emits the appropriate events.
 *
 * Called when:
 * - SerialPortService fires a portsChanged callback (port added or removed)
 * - start() completes the initial CLI refresh
 */
function runIdentificationCycle(): void {
  if (!_services) return

  const results = _services.identification.identify()
  HardwareEventBus.emit('identificationChanged', results)

  const snapshot = assembleSnapshot()
  HardwareEventBus.emit('hardwareStateChanged', snapshot)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Injects the services that HardwareManager will orchestrate.
 *
 * Must be called before start(). Calling initialize() replaces any
 * previously injected services. Safe to call multiple times (idempotent
 * in terms of state as long as start() has not been called).
 *
 * In production, this is called from the Electron main process entry point
 * with the concrete service implementations from Slice 3.
 *
 * @param services - The service implementations to orchestrate.
 */
function initialize(services: HardwareServices): void {
  _services = services
}

/**
 * Starts the hardware discovery lifecycle.
 *
 * Sequence:
 * 1. Validates that initialize() was called.
 * 2. Registers the port-change callback on SerialPortService.
 *    When ports change → identification runs → hardwareStateChanged emits.
 * 3. Refreshes the arduino-cli state and emits cliStateChanged.
 * 4. Starts SerialPortService polling (immediate first scan included).
 * 5. Emits an initial hardwareStateChanged so listeners receive state immediately.
 *
 * This method is idempotent — calling start() when already running is a no-op.
 */
async function start(): Promise<void> {
  if (_running) return
  if (!_services) {
    throw new Error(
      'HardwareManager: start() called before initialize(). ' + 'Call initialize(services) first.'
    )
  }

  _running = true

  // Step 2: Wire up the port-change → identification pipeline
  _services.ports.onPortsChanged((ports) => {
    HardwareEventBus.emit('portsChanged', ports)
    runIdentificationCycle()
  })

  // Step 3: Refresh CLI state
  const cli = await _services.cli.refresh()
  HardwareEventBus.emit('cliStateChanged', cli)

  // Step 4: Start port polling (triggers immediate first scan)
  await _services.ports.startPolling()

  // Step 5: Emit an initial snapshot regardless of whether ports changed,
  // so the first IPC call to getState() returns meaningful data immediately.
  const snapshot = assembleSnapshot()
  HardwareEventBus.emit('hardwareStateChanged', snapshot)
}

/**
 * Stops the hardware discovery lifecycle and cleans up resources.
 *
 * Sequence:
 * 1. Stops SerialPortService polling.
 * 2. Removes all HardwareEventBus listeners.
 * 3. Resets running state.
 *
 * Safe to call when already stopped (no-op if not running).
 * After stop(), initialize() + start() must be called again to resume.
 */
function stop(): void {
  if (!_running) return
  if (!_services) return

  _services.ports.stopPolling()
  HardwareEventBus.removeAllListeners()

  _running = false
}

/**
 * Returns a fresh IHardwareState snapshot assembled from all services.
 *
 * Used by:
 * - IPC handlers (Slice 5) to respond to `hardware:getState` and `hardware:refresh` calls.
 * - Any future service that needs a point-in-time view of hardware state.
 *
 * This method never throws — if services are not yet initialized, it returns
 * a safe empty state so IPC calls do not crash the main process.
 */
function getState(): IHardwareState {
  if (!_services || !_running) {
    return {
      cli: { isInstalled: false, version: null, installedCores: [] },
      ports: [],
      connectedBoards: [],
      selectedBoardId: null,
      isScanning: false,
      lastScanTimestamp: 0
    }
  }

  return assembleSnapshot()
}

/**
 * Returns true if the hardware discovery lifecycle is currently active.
 */
function isRunning(): boolean {
  return _running
}

/**
 * Forces an out-of-cycle hardware refresh and returns the updated snapshot.
 *
 * Sequence:
 * 1. Re-queries arduino-cli (version + installed cores).
 * 2. Performs an immediate port scan outside the normal 2-second interval.
 * 3. Re-runs board identification against the fresh port list.
 * 4. Assembles and returns a new IHardwareState snapshot.
 *
 * Unlike getState(), this method performs real I/O. It is intended for
 * user-initiated "refresh" actions in the Renderer (e.g. a "Scan again" button
 * or a one-time query on page load before the first push event arrives).
 *
 * If the hardware lifecycle is not running, returns the same safe empty state
 * as getState() — no I/O is performed.
 */
async function refresh(): Promise<IHardwareState> {
  if (!_services || !_running) {
    return {
      cli: { isInstalled: false, version: null, installedCores: [] },
      ports: [],
      connectedBoards: [],
      selectedBoardId: null,
      isScanning: false,
      lastScanTimestamp: 0
    }
  }

  // Step 1: Re-query Arduino CLI
  const cli = await _services.cli.refresh()
  HardwareEventBus.emit('cliStateChanged', cli)

  // Step 2: Immediate port re-scan (out of the 2-second interval)
  await _services.ports.pollNow()

  // Step 3: Re-run identification against the freshly scanned port list
  runIdentificationCycle()

  // Step 4: Assemble and return the updated snapshot
  return assembleSnapshot()
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const HardwareManager = Object.freeze({
  initialize,
  start,
  stop,
  getState,
  refresh,
  isRunning
})
