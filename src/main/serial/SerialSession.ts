/**
 * SerialSession
 *
 * Owns and manages a single active serial port connection.
 *
 * Architectural rules:
 * - Single responsibility: one port connection, its data stream, and its lifecycle.
 * - Never communicates with IPC, preload, Zustand, or the Renderer.
 * - Never throws to callers — all errors are returned as typed ISerialResult values
 *   or emitted as 'serial:error' / 'serial:statusChanged' events.
 * - Delegates byte parsing to an ISerialParser — not coupled to ReadlineParser directly.
 * - Emits domain events to SerialEventBus. The IPC layer subscribes to those events.
 * - Lifecycle: created by SerialService → open() → data streaming → close() → destroyed.
 * - A SerialSession instance is single-use: once closed it cannot be reopened.
 *   SerialService creates a fresh instance on every open() call.
 *
 * Public API:
 * - open()   → ISerialResult   (opens the port, starts streaming, returns result)
 * - close()  → Promise<void>   (graceful teardown, always resolves)
 * - write()  → ISerialResult   (writes text, applies newline settings)
 *
 * Events emitted to SerialEventBus:
 * - serial:line           (payload: ISerialDataPayload)
 * - serial:statusChanged  (payload: ISerialStatusPayload)
 * - serial:error          (port: string, error: Error)
 */

import { SerialPort } from 'serialport'
import type { ISerialOpenRequest, ISerialResult, ISerialSettings } from '@shared/types/serial'
import type { ISerialParser } from './SerialParser'
import { createDefaultParser } from './SerialParser'
import { SerialEventBus } from './SerialEventBus'

// ---------------------------------------------------------------------------
// Newline byte sequences
// ---------------------------------------------------------------------------

const NEWLINE_BYTES: Record<ISerialSettings['newline'], string> = {
  none: '',
  cr: '\r',
  lf: '\n',
  crlf: '\r\n'
}

// ---------------------------------------------------------------------------
// SerialSession
// ---------------------------------------------------------------------------

export class SerialSession {
  /** The OS port path (e.g. "COM3", "/dev/ttyUSB0") */
  readonly port: string

  /** Connection settings used to open this session */
  readonly settings: ISerialSettings

  /** The serialport instance — null until open() succeeds */
  private _sp: SerialPort | null = null

  /** The parser instance — null until open() succeeds */
  private _parser: ISerialParser | null = null

  /** True once close() has been called — sessions are single-use */
  private _closed = false

  /**
   * @param request - The port and settings to open this session with.
   * @param parserFactory - Optional factory for injecting a custom parser (useful
   *   in tests). Defaults to createDefaultParser (ReadlineSerialParser).
   */
  constructor(
    request: ISerialOpenRequest,
    private readonly _parserFactory: () => ISerialParser = createDefaultParser
  ) {
    this.port = request.port
    this.settings = request.settings
  }

  // ---------------------------------------------------------------------------
  // Public: open
  // ---------------------------------------------------------------------------

  /**
   * Opens the serial port and starts the data streaming pipeline.
   *
   * Steps:
   * 1. Instantiates a SerialPort with autoOpen: false.
   * 2. Attaches the parser and wires up stream events.
   * 3. Opens the port asynchronously.
   * 4. Emits serial:statusChanged (connected) on success.
   *
   * Returns { status: 'success' } on success.
   * Returns { status: 'error', code, error } on all failure cases.
   * Never throws.
   */
  async open(): Promise<ISerialResult> {
    if (this._closed) {
      return {
        status: 'error',
        code: 'port_not_found',
        error: `Session for ${this.port} has already been closed and cannot be reopened.`
      }
    }

    try {
      this._sp = new SerialPort({
        path: this.port,
        baudRate: this.settings.baudRate,
        autoOpen: false
      })

      this._parser = this._parserFactory()

      // Wire the parser line callback to emit serial:line events
      this._parser.onLine((line: string) => {
        SerialEventBus.emit('serial:line', { port: this.port, line })
      })

      // Handle unexpected closes (e.g. device unplugged)
      this._sp.on('close', (err?: Error | null) => {
        if (!this._closed) {
          // The port closed without our explicit close() call — treat as error
          this._closed = true
          this._cleanup()

          const message = err?.message ?? `Serial port ${this.port} closed unexpectedly.`

          SerialEventBus.emit('serial:statusChanged', {
            port: this.port,
            status: 'error',
            error: message
          })

          if (err) {
            SerialEventBus.emit('serial:error', this.port, err)
          }
        }
      })

      // Propagate serialport errors (e.g. framing, overrun)
      this._sp.on('error', (err: Error) => {
        SerialEventBus.emit('serial:error', this.port, err)
      })

      // Open the port and await the result
      await this._openPort(this._sp)

      // Attach the parser now that the port is open
      this._parser.attach(this._sp)

      SerialEventBus.emit('serial:statusChanged', {
        port: this.port,
        status: 'connected',
        error: null
      })

      return { status: 'success' }
    } catch (err: unknown) {
      this._closed = true
      this._cleanup()
      return this._mapOpenError(err)
    }
  }

  // ---------------------------------------------------------------------------
  // Public: close
  // ---------------------------------------------------------------------------

  /**
   * Gracefully closes the serial port and tears down all resources.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   * Emits serial:statusChanged (closed) if the session was previously open.
   * Never throws.
   */
  async close(): Promise<void> {
    if (this._closed) return
    this._closed = true

    await this._closePort()
    this._cleanup()

    SerialEventBus.emit('serial:statusChanged', {
      port: this.port,
      status: 'closed',
      error: null
    })
  }

  // ---------------------------------------------------------------------------
  // Public: write
  // ---------------------------------------------------------------------------

  /**
   * Writes a text string to the open serial port.
   *
   * Appends the newline sequence from the write request's `newline` setting
   * before sending. The port must be open — writing to a closed session
   * returns a typed error without throwing.
   *
   * @param text    - The raw text to write (no terminator).
   * @param newline - The newline mode to append.
   */
  async write(text: string, newline: ISerialSettings['newline']): Promise<ISerialResult> {
    if (this._closed || !this._sp || !this._sp.isOpen) {
      return {
        status: 'error',
        code: 'port_not_open',
        error: `Cannot write: serial port ${this.port} is not open.`
      }
    }

    const payload = text + NEWLINE_BYTES[newline]

    try {
      await this._writeToPort(this._sp, payload)
      return { status: 'success' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown write error.'
      return {
        status: 'error',
        code: 'write_failed',
        error: `Failed to write to ${this.port}: ${message}`
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private: port helpers (promise wrappers around callback APIs)
  // ---------------------------------------------------------------------------

  /**
   * Opens the port, wrapping the callback API in a Promise.
   * Rejects with the OS error on failure.
   */
  private _openPort(sp: SerialPort): Promise<void> {
    return new Promise((resolve, reject) => {
      sp.open((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * Closes the port, wrapping the callback API in a Promise.
   * Resolves even if the port was already closed (best-effort teardown).
   */
  private _closePort(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._sp || !this._sp.isOpen) {
        resolve()
        return
      }
      this._sp.close((err) => {
        if (err) {
          // Log internally but do not reject — close must always succeed
          console.warn(`[SerialSession] close error on ${this.port}:`, err.message)
        }
        resolve()
      })
    })
  }

  /**
   * Writes bytes, wrapping the callback API in a Promise.
   * Rejects with the write error on failure.
   */
  private _writeToPort(sp: SerialPort, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sp.write(data, 'utf-8', (err) => {
        if (err) reject(err)
        else
          sp.drain((drainErr) => {
            if (drainErr) reject(drainErr)
            else resolve()
          })
      })
    })
  }

  /**
   * Tears down the parser. The SerialPort instance is not explicitly destroyed
   * here — close() handles the port lifecycle. This is cleanup for parser
   * resources only.
   */
  private _cleanup(): void {
    if (this._parser) {
      this._parser.close()
      this._parser = null
    }
    this._sp = null
  }

  // ---------------------------------------------------------------------------
  // Private: error mapping
  // ---------------------------------------------------------------------------

  /**
   * Maps a raw serialport open error into a typed ISerialResult error.
   *
   * serialport reports OS errors as Error objects with message strings.
   * We pattern-match on the message to produce meaningful structured codes.
   */
  private _mapOpenError(err: unknown): ISerialResult {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()

    if (lower.includes('access denied') || lower.includes('permission denied')) {
      return {
        status: 'error',
        code: 'permission_denied',
        error: `Permission denied opening ${this.port}. Close any other program using this port.`
      }
    }

    if (
      lower.includes('file not found') ||
      lower.includes('no such file') ||
      lower.includes('cannot open')
    ) {
      return {
        status: 'error',
        code: 'port_not_found',
        error: `Port ${this.port} not found. Is the board still connected?`
      }
    }

    if (lower.includes('resource busy') || lower.includes('device busy')) {
      return {
        status: 'error',
        code: 'port_busy',
        error: `Port ${this.port} is busy. Another program may be using it.`
      }
    }

    return {
      status: 'error',
      code: 'unknown',
      error: `Could not open ${this.port}: ${message}`
    }
  }
}
