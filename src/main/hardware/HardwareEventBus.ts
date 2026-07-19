/**
 * HardwareEventBus
 *
 * A lightweight, strongly typed internal event bus for the Hardware Abstraction Layer.
 *
 * Architectural rules:
 * - Internal communication only — no Electron, IPC, or Renderer dependencies.
 * - Provides loose coupling between services and HardwareManager.
 * - All events are typed. No untyped `emit('string', any)` calls are allowed.
 * - Extensible: new event types are added to IHardwareEventMap without breaking callers.
 * - Built on Node.js EventEmitter — stable, zero-dependency, and already available in Electron's main process.
 *
 * Current events:
 * - portsChanged:           SerialPortService detected a port list mutation.
 * - cliStateChanged:        ArduinoCLIService completed a refresh cycle.
 * - identificationChanged:  BoardIdentificationService completed an identification pass.
 * - hardwareStateChanged:   HardwareManager assembled a new IHardwareState snapshot.
 *
 * Future events (not implemented, documented for extensibility):
 * - uploadStarted, uploadProgress, uploadCompleted, uploadFailed  (Phase 3 / UploadService)
 * - serialPortOpened, serialDataReceived, serialPortClosed        (Phase 4 / SerialService)
 *
 * Usage:
 *   HardwareEventBus.on('portsChanged', (ports) => { ... })
 *   HardwareEventBus.emit('portsChanged', ports)
 *   HardwareEventBus.off('portsChanged', handler)
 */

import { EventEmitter } from 'events'
import type {
  ISerialPort,
  IArduinoCLI,
  IIdentificationResult,
  IHardwareState
} from '@shared/types/hardware'

// ---------------------------------------------------------------------------
// Event map — the strongly typed contract for all internal HAL events
// ---------------------------------------------------------------------------

/**
 * Defines every event name and its associated payload type.
 *
 * Adding a new event:
 *   1. Add the event name and payload type here.
 *   2. Call emit() at the appropriate point in the originating service.
 *   3. Subscribe with on() in HardwareManager or any future service.
 *
 * No other file should be modified to support a new event.
 */
export interface IHardwareEventMap {
  /** Emitted by HardwareManager when SerialPortService reports a port list change. */
  portsChanged: [ports: ISerialPort[]]

  /** Emitted by HardwareManager after ArduinoCLIService.refresh() completes. */
  cliStateChanged: [cli: IArduinoCLI]

  /**
   * Emitted by HardwareManager after BoardIdentificationService.identify() completes.
   * Carries the full result set including ambiguous and unknown entries.
   */
  identificationChanged: [results: IIdentificationResult[]]

  /**
   * Emitted by HardwareManager after assembling a fresh IHardwareState snapshot.
   * This is the primary event consumed by IPC handlers (Slice 5) to push state
   * to the Renderer.
   */
  hardwareStateChanged: [state: IHardwareState]
}

// ---------------------------------------------------------------------------
// Typed wrapper — enforces IHardwareEventMap at every call site
// ---------------------------------------------------------------------------

/**
 * A strongly typed wrapper around Node.js EventEmitter.
 *
 * TypeScript cannot parameterise EventEmitter's overloaded signatures directly,
 * so we expose a narrow typed API (`on`, `off`, `emit`, `once`) backed by
 * a private EventEmitter instance.
 *
 * This keeps the implementation simple while preventing untyped `emit` calls.
 */
class TypedHardwareEventBus {
  private readonly _emitter = new EventEmitter()

  /**
   * Subscribes to an event. The listener is called every time the event fires.
   *
   * @param event    - The event name (must be a key of IHardwareEventMap)
   * @param listener - The callback to invoke with the event's typed payload
   */
  on<K extends keyof IHardwareEventMap>(
    event: K,
    listener: (...args: IHardwareEventMap[K]) => void
  ): void {
    this._emitter.on(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Subscribes to an event for a single invocation only.
   * The listener is automatically removed after it fires once.
   */
  once<K extends keyof IHardwareEventMap>(
    event: K,
    listener: (...args: IHardwareEventMap[K]) => void
  ): void {
    this._emitter.once(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Removes a previously registered listener.
   */
  off<K extends keyof IHardwareEventMap>(
    event: K,
    listener: (...args: IHardwareEventMap[K]) => void
  ): void {
    this._emitter.off(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Emits an event synchronously to all registered listeners.
   *
   * @param event - The event name
   * @param args  - The typed payload matching IHardwareEventMap[event]
   */
  emit<K extends keyof IHardwareEventMap>(event: K, ...args: IHardwareEventMap[K]): void {
    this._emitter.emit(event as string, ...args)
  }

  /**
   * Removes all listeners from all events.
   * Called by HardwareManager.stop() during application teardown.
   */
  removeAllListeners(): void {
    this._emitter.removeAllListeners()
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — one bus per process, shared by all HAL components
// ---------------------------------------------------------------------------

/**
 * The single HardwareEventBus instance for the application.
 *
 * Singleton is appropriate here because:
 * - There is exactly one hardware layer per Electron main process.
 * - Services and HardwareManager must share the same bus to communicate.
 * - The bus holds no business state — it is purely a communication channel.
 */
export const HardwareEventBus = new TypedHardwareEventBus()
