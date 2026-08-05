/**
 * UploadEventBus
 *
 * A lightweight, strongly typed internal event bus for the Upload domain's
 * Integrated Terminal streaming.
 *
 * Architectural rules:
 * - Internal communication only — no Electron, IPC, or Renderer dependencies.
 * - Provides loose coupling between UploadService and the IPC layer.
 * - All events are typed. No untyped `emit('string', any)` calls are allowed.
 * - Built on Node.js EventEmitter — stable, zero-dependency, already available.
 * - Mirrors the design established by HardwareEventBus and SerialEventBus.
 * - Dedicated to the upload domain only. Consolidation with other buses is
 *   intentionally deferred to a future architecture modernization phase.
 *
 * Current events:
 * - upload:log: UploadService produced a new command/stdout/stderr chunk
 *   while compiling or uploading firmware.
 *
 * Usage:
 *   UploadEventBus.on('upload:log', (payload) => { ... })
 *   UploadEventBus.emit('upload:log', payload)
 *   UploadEventBus.off('upload:log', handler)
 */

import { EventEmitter } from 'events'
import type { IUploadLogPayload } from '@shared/types/upload'

// ---------------------------------------------------------------------------
// Event map — the strongly typed contract for all internal upload events
// ---------------------------------------------------------------------------

/**
 * Defines every event name and its associated payload type.
 *
 * Adding a new event:
 *   1. Add the event name and payload type here.
 *   2. Call emit() at the appropriate point in UploadService.
 *   3. Subscribe with on() in uploadIpcHandlers or any future service.
 *
 * No other file should be modified to support a new event.
 */
export interface IUploadEventMap {
  /**
   * Emitted by UploadService each time a compile or upload subprocess
   * produces a chunk of output, or immediately before a subprocess is
   * spawned (stream: 'command'). Never batched until process exit — the
   * IPC layer forwards each event to the Renderer via the upload:log push
   * channel as soon as it fires.
   */
  'upload:log': [payload: IUploadLogPayload]
}

// ---------------------------------------------------------------------------
// Typed wrapper — enforces IUploadEventMap at every call site
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
class TypedUploadEventBus {
  private readonly _emitter = new EventEmitter()

  /**
   * Subscribes to an event. The listener is called every time the event fires.
   *
   * @param event    - The event name (must be a key of IUploadEventMap)
   * @param listener - The callback to invoke with the event's typed payload
   */
  on<K extends keyof IUploadEventMap>(
    event: K,
    listener: (...args: IUploadEventMap[K]) => void
  ): void {
    this._emitter.on(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Subscribes to an event for a single invocation only.
   * The listener is automatically removed after it fires once.
   */
  once<K extends keyof IUploadEventMap>(
    event: K,
    listener: (...args: IUploadEventMap[K]) => void
  ): void {
    this._emitter.once(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Removes a previously registered listener.
   */
  off<K extends keyof IUploadEventMap>(
    event: K,
    listener: (...args: IUploadEventMap[K]) => void
  ): void {
    this._emitter.off(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Emits an event synchronously to all registered listeners.
   *
   * @param event - The event name
   * @param args  - The typed payload matching IUploadEventMap[event]
   */
  emit<K extends keyof IUploadEventMap>(event: K, ...args: IUploadEventMap[K]): void {
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
// Singleton instance — one bus per process, shared by all upload components
// ---------------------------------------------------------------------------

/**
 * The single UploadEventBus instance for the application.
 *
 * Singleton is appropriate here because:
 * - There is exactly one upload layer per Electron main process.
 * - UploadService and the IPC layer must share the same bus.
 * - The bus holds no business state — it is purely a communication channel.
 */
export const UploadEventBus = new TypedUploadEventBus()
