/**
 * SerialService
 *
 * Singleton orchestrator for all active serial port sessions.
 *
 * Architectural rules:
 * - Single responsibility: manage the registry of active SerialSession instances.
 * - Delegates all port I/O to SerialSession — contains no stream logic itself.
 * - Never communicates with IPC, preload, Zustand, or the Renderer.
 * - Never throws to callers — all errors are returned as typed ISerialResult values.
 * - Session registry is keyed by port path (e.g. "COM3", "/dev/ttyUSB0").
 *   This allows multiple simultaneous sessions for multi-board monitoring in
 *   future phases without architectural changes.
 * - IPC handlers (Slice 15) are the exclusive callers of this service.
 *
 * Public API:
 * - open(request)         → ISerialResult  (opens a new session for the port)
 * - close(port)           → ISerialResult  (closes and removes the session)
 * - write(port, text, nl) → ISerialResult  (writes text to the active session)
 * - closeAll()            → Promise<void>  (tears down all sessions at shutdown)
 * - hasSession(port)      → boolean        (checks if a session is active)
 *
 * IPC integration: serialIpcHandlers.ts (Phase 4, Slice 15) delegates all
 * public methods to the Renderer via the serial:* invoke channels.
 */

import { SerialSession } from './SerialSession'
import type { ISerialOpenRequest, ISerialResult, ISerialSettings } from '@shared/types/serial'

// ---------------------------------------------------------------------------
// Session registry
// ---------------------------------------------------------------------------

/**
 * Active sessions keyed by port path.
 * Module-level to share state across all calls within the same Main process.
 * Not exported — callers interact exclusively through the SerialService API.
 */
const _sessions = new Map<string, SerialSession>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Opens a new serial session on the requested port.
 *
 * Guards:
 * - Returns a typed error if a session is already open for this port.
 *   Callers must close() the existing session before opening a new one.
 *
 * On success:
 * - A SerialSession is created, opened, and registered in the session map.
 * - The session begins emitting serial:line and serial:statusChanged events
 *   to SerialEventBus immediately.
 *
 * On failure:
 * - The failed session is discarded. The registry is not polluted.
 * - Returns a typed ISerialResult error. Never throws.
 */
async function open(request: ISerialOpenRequest): Promise<ISerialResult> {
  if (_sessions.has(request.port)) {
    return {
      status: 'error',
      code: 'port_already_open',
      error: `A session for ${request.port} is already active. Close it before opening a new one.`
    }
  }

  const session = new SerialSession(request)
  const result = await session.open()

  if (result.status === 'success') {
    _sessions.set(request.port, session)
  }
  // On failure, session.open() has already cleaned up internally.

  return result
}

/**
 * Closes the active serial session for the given port.
 *
 * Guards:
 * - Returns a typed error if no session exists for this port.
 *
 * On success:
 * - The session is gracefully closed (port released, parser torn down).
 * - The session is removed from the registry.
 * - SerialEventBus emits serial:statusChanged (closed).
 */
async function close(port: string): Promise<ISerialResult> {
  const session = _sessions.get(port)

  if (!session) {
    return {
      status: 'error',
      code: 'port_not_open',
      error: `No active session for ${port}. It may have already been closed.`
    }
  }

  _sessions.delete(port)
  await session.close()
  return { status: 'success' }
}

/**
 * Writes a text string to the active serial session for the given port.
 *
 * Guards:
 * - Returns a typed error if no session exists for this port.
 *
 * The newline setting controls what terminator (if any) is appended.
 * The actual bytes are written and drained before the result is returned.
 */
async function write(
  port: string,
  text: string,
  newline: ISerialSettings['newline']
): Promise<ISerialResult> {
  const session = _sessions.get(port)

  if (!session) {
    return {
      status: 'error',
      code: 'port_not_open',
      error: `Cannot write to ${port}: no active session. Open the port first.`
    }
  }

  return session.write(text, newline)
}

/**
 * Closes all active sessions.
 *
 * Called during application teardown (app quit, window close) to ensure
 * all OS port handles are released cleanly before the process exits.
 *
 * Errors from individual close() calls are suppressed — this is best-effort
 * cleanup and must not prevent the process from shutting down.
 */
async function closeAll(): Promise<void> {
  // Capture session references BEFORE clearing the registry so that each
  // session.close() call still has a valid reference. Clearing first and then
  // looking up via _sessions.get() would always return undefined because the
  // map is already empty by the time the async callbacks execute.
  const sessions = [..._sessions.values()]
  _sessions.clear()

  await Promise.allSettled(
    sessions.map(async (session) => {
      try {
        await session.close()
      } catch {
        // Intentionally suppressed — teardown must always complete
      }
    })
  )
}

/**
 * Returns true if an active session exists for the given port.
 * Used by IPC handlers to guard duplicate open() calls if needed.
 */
function hasSession(port: string): boolean {
  return _sessions.has(port)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const SerialService = Object.freeze({
  open,
  close,
  write,
  closeAll,
  hasSession
})
