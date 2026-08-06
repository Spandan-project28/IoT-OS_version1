/**
 * AiEventBus
 *
 * A lightweight, strongly typed internal event bus for the AI generation
 * domain's Integrated Terminal streaming.
 *
 * Architectural rules:
 * - Internal communication only — no Electron, IPC, or Renderer dependencies.
 * - Provides loose coupling between AIService and the IPC layer.
 * - All events are typed. No untyped `emit('string', any)` calls are allowed.
 * - Built on Node.js EventEmitter — mirrors UploadEventBus's design exactly.
 * - Dedicated to the AI domain only. Consolidation with UploadEventBus is
 *   intentionally deferred to a future architecture modernization phase.
 *
 * Current events:
 * - ai:log: AIService produced a new step, request/response detail, or
 *   error while generating or improving firmware.
 *
 * Usage:
 *   AiEventBus.on('ai:log', (payload) => { ... })
 *   AiEventBus.emit('ai:log', payload)
 *   AiEventBus.off('ai:log', handler)
 */

import { EventEmitter } from 'events'
import type { IAILogPayload } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// Event map — the strongly typed contract for all internal AI events
// ---------------------------------------------------------------------------

/**
 * Defines every event name and its associated payload type.
 *
 * Adding a new event:
 *   1. Add the event name and payload type here.
 *   2. Call emit() at the appropriate point in AIService.
 *   3. Subscribe with on() in aiIpcHandlers or any future service.
 *
 * No other file should be modified to support a new event.
 */
export interface IAiEventMap {
  /**
   * Emitted by AIService at every step of the generation pipeline — never
   * batched until the ai:generate invoke call resolves. The IPC layer
   * forwards each event to the Renderer via the ai:log push channel as
   * soon as it fires — see aiIpcHandlers.ts.
   */
  'ai:log': [payload: IAILogPayload]
}

// ---------------------------------------------------------------------------
// Typed wrapper — enforces IAiEventMap at every call site
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
class TypedAiEventBus {
  private readonly _emitter = new EventEmitter()

  /**
   * Subscribes to an event. The listener is called every time the event fires.
   *
   * @param event    - The event name (must be a key of IAiEventMap)
   * @param listener - The callback to invoke with the event's typed payload
   */
  on<K extends keyof IAiEventMap>(
    event: K,
    listener: (...args: IAiEventMap[K]) => void
  ): void {
    this._emitter.on(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Subscribes to an event for a single invocation only.
   * The listener is automatically removed after it fires once.
   */
  once<K extends keyof IAiEventMap>(
    event: K,
    listener: (...args: IAiEventMap[K]) => void
  ): void {
    this._emitter.once(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Removes a previously registered listener.
   */
  off<K extends keyof IAiEventMap>(
    event: K,
    listener: (...args: IAiEventMap[K]) => void
  ): void {
    this._emitter.off(event as string, listener as (...args: unknown[]) => void)
  }

  /**
   * Emits an event synchronously to all registered listeners.
   *
   * @param event - The event name
   * @param args  - The typed payload matching IAiEventMap[event]
   */
  emit<K extends keyof IAiEventMap>(event: K, ...args: IAiEventMap[K]): void {
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
// Singleton instance — one bus per process, shared by all AI components
// ---------------------------------------------------------------------------

/**
 * The single AiEventBus instance for the application.
 *
 * Singleton is appropriate here because:
 * - There is exactly one AI generation layer per Electron main process.
 * - AIService and the IPC layer must share the same bus.
 * - The bus holds no business state — it is purely a communication channel.
 */
export const AiEventBus = new TypedAiEventBus()
