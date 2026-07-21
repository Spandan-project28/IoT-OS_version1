/**
 * SerialEventBus
 *
 * A lightweight, strongly typed internal event bus for the Serial Monitor domain.
 *
 * Architectural rules:
 * - Internal communication only — no Electron, IPC, or Renderer dependencies.
 * - Provides loose coupling between SerialSession instances and the IPC layer.
 * - All events are typed. No untyped `emit('string', any)` calls are allowed.
 * - Extensible: new event types are added to ISerialEventMap without breaking callers.
 * - Built on Node.js EventEmitter — stable, zero-dependency, already available.
 * - Mirrors the design established by HardwareEventBus.
 * - Dedicated to the serial domain only. Consolidation with other buses is
 *   intentionally deferred to a future architecture modernization phase.
 *
 * Current events:
 * - serial:line:           SerialSession received and parsed a complete line.
 * - serial:statusChanged:  SerialSession lifecycle state changed (connected, closed, error).
 * - serial:error:          SerialSession encountered an unrecoverable error.
 *
 * Usage:
 *   SerialEventBus.on('serial:line', ({ port, line }) => { ... })
 *   SerialEventBus.emit('serial:line', { port, line })
 *   SerialEventBus.off('serial:line', handler)
 */

import { EventEmitter } from 'events'
import type { ISerialDataPayload, ISerialStatusPayload } from '@shared/types/serial'

// ---------------------------------------------------------------------------
// Event map — the strongly typed contract for all internal serial events
// ---------------------------------------------------------------------------

/**
 * Defines every event name and its associated payload type.
 *
 * Adding a new event:
 *   1. Add the event name and payload type here.
 *   2. Call emit() at the appropriate point in SerialSession.
 *   3. Subscribe with on() in serialIpcHandlers or any future service.
 *
 * No other file should be modified to support a new event.
 */
export interface ISerialEventMap {
  /**
   * Emitted by SerialSession each time the parser produces a complete line.
   * One event per line — no batching in V0.1.
   * The IPC layer forwards this to the Renderer via serial:data push.
   */
  'serial:line': [payload: ISerialDataPayload]

  /**
   * Emitted by SerialSession whenever its lifecycle status changes:
   * - opened (status: 'connected')
   * - closed gracefully (status: 'closed')
   * - closed due to error (status: 'error', error set)
   *
   * The IPC layer forwards this to the Renderer via serial:statusChanged push.
   */
  'serial:statusChanged': [payload: ISerialStatusPayload]

  /**
   * Emitted by SerialSession when an unexpected error occurs that has
   * already caused the session to close. The IPC layer may use this for
   * internal logging in addition to the serial:statusChanged event.
   */
  'serial:error': [port: string, error: Error]
}

// ---------------------------------------------------------------------------
// Typed wrapper — enforces ISerialEventMap at every call site
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
class TypedSerialEventBus {
  private readonly _emitter = new EventEmitter()

  /**
   * Subscribes to an event. The listener is called every time the event fires.
   *
   * @param event    - The event name (must be a key of ISerialEventMap)
   * @param listener - The callback to invoke with the event's typed payload
   */
  on<K extends keyof ISerialEventMap>(
    event: K,
    listener: (...args: ISerialEventMap[K]) => void
  ): void {
    this._emitter.on(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Subscribes to an event for a single invocation only.
   * The listener is automatically removed after it fires once.
   */
  once<K extends keyof ISerialEventMap>(
    event: K,
    listener: (...args: ISerialEventMap[K]) => void
  ): void {
    this._emitter.once(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Removes a previously registered listener.
   */
  off<K extends keyof ISerialEventMap>(
    event: K,
    listener: (...args: ISerialEventMap[K]) => void
  ): void {
    this._emitter.off(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Emits an event synchronously to all registered listeners.
   *
   * @param event - The event name
   * @param args  - The typed payload matching ISerialEventMap[event]
   */
  emit<K extends keyof ISerialEventMap>(event: K, ...args: ISerialEventMap[K]): void {
    this._emitter.emit(event as string, ...args)
  }

  /**
   * Removes all listeners from all events.
   * Called during application teardown or test cleanup.
   */
  removeAllListeners(): void {
    this._emitter.removeAllListeners()
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — one bus per process, shared by all serial components
// ---------------------------------------------------------------------------

/**
 * The single SerialEventBus instance for the application.
 *
 * Singleton is appropriate here because:
 * - There is exactly one serial layer per Electron main process.
 * - SerialSession instances and the IPC layer must share the same bus.
 * - The bus holds no business state — it is purely a communication channel.
 */
export const SerialEventBus = new TypedSerialEventBus()
