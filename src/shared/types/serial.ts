/**
 * serial.ts
 *
 * Shared type definitions for the Serial Monitor domain.
 *
 * Intentionally separated from hardware.ts and upload.ts to keep each domain
 * self-contained as additional domains are introduced across phases.
 *
 * Consumers:
 * - SerialService       (Main process — manages ISerialSession lifecycle)
 * - SerialEventBus      (Main process — typed event payloads)
 * - IPC handlers        (Slice 15 — serialises results across the bridge)
 * - Zustand store       (Slice 16 — per-port state and log storage)
 *
 * Future consumers (out of scope for V0.1):
 * - Serial Plotter      (subscribes to ISerialDataPayload for graphing)
 * - CSV Logger          (persists ISerialLogLine records to disk)
 * - AI Debugger         (reads serialLogs from store or a dedicated buffer)
 */

// ---------------------------------------------------------------------------
// Settings
//
// Connection configuration. Intentionally separated from ISerialSessionState
// so settings can be edited while disconnected and applied on the next open()
// without contaminating live session runtime state.
// ---------------------------------------------------------------------------

/**
 * Newline mode appended to outgoing text when the user sends from the UI.
 *
 * - 'none'  — text is sent exactly as entered (no terminator added)
 * - 'cr'    — appends carriage return only (\r)
 * - 'lf'    — appends line feed only (\n)
 * - 'crlf'  — appends carriage return + line feed (\r\n), most common for Arduino
 */
export type SerialNewline = 'none' | 'cr' | 'lf' | 'crlf'

/**
 * Connection configuration for a serial port session.
 *
 * Kept separate from session runtime state so it can be persisted to user
 * preferences and restored across restarts without coupling to live state.
 *
 * Defaults are chosen to match Arduino IDE conventions so beginners are
 * never surprised by unexpected settings.
 */
export interface ISerialSettings {
  /**
   * Baud rate for the serial connection.
   *
   * Common values: 9600, 19200, 38400, 57600, 115200.
   * Default: 9600 (matches Arduino IDE default).
   */
  baudRate: number

  /**
   * Newline mode appended to outgoing user input.
   * Default: 'crlf' (expected by most Arduino Serial.readStringUntil() calls).
   */
  newline: SerialNewline
}

// ---------------------------------------------------------------------------
// Requests (Renderer → Main via IPC invoke)
//
// All three IPC invoke requests carry the port as a string (e.g. "COM3",
// "/dev/ttyUSB0") so the Main process can locate the correct SerialSession.
// ---------------------------------------------------------------------------

/**
 * Request to open a new serial session on the given port.
 *
 * The session is owned by SerialService. A subsequent serial:open for the
 * same port without a prior serial:close is treated as an error.
 */
export interface ISerialOpenRequest {
  /** OS port path (e.g. "COM3", "/dev/ttyUSB0") */
  port: string
  /** Connection settings to apply for this session */
  settings: ISerialSettings
}

/**
 * Request to close an active serial session.
 *
 * Closing a port that is not open returns a typed error rather than throwing.
 */
export interface ISerialCloseRequest {
  /** OS port path of the session to close */
  port: string
}

/**
 * Request to write a text string to an active serial session.
 *
 * The newline setting from ISerialSettings is applied server-side so the
 * Renderer does not need to know the actual byte encoding.
 */
export interface ISerialWriteRequest {
  /** OS port path of the session to write to */
  port: string
  /** Raw text entered by the user, without any newline appended */
  text: string
  /**
   * Newline mode to apply before writing.
   * Typically sourced from the active ISerialSettings for this port.
   */
  newline: SerialNewline
}

// ---------------------------------------------------------------------------
// Session State
//
// Runtime state for a single active serial session.
// Kept separate from ISerialSettings (configuration) to keep state clean.
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a serial port session.
 *
 * - 'closed'      — no session exists for this port
 * - 'connecting'  — session is being established (async gap)
 * - 'connected'   — session is open and streaming data
 * - 'error'       — session was closed due to an unexpected error
 *                   (e.g. device unplugged, permission denied)
 */
export type SerialStatus = 'closed' | 'connecting' | 'connected' | 'error'

/**
 * Runtime snapshot of a single serial port session.
 *
 * Keyed by port in the Zustand store so multiple boards can be monitored
 * simultaneously without crosstalk.
 *
 * This type is serializable — it must never carry non-serializable values
 * (no runtime handles, no Promises, no EventEmitters).
 */
export interface ISerialSessionState {
  /** OS port path this session is associated with */
  port: string

  /** Current lifecycle status of the session */
  status: SerialStatus

  /** Connection settings that were used to open this session */
  settings: ISerialSettings

  /**
   * Human-readable error message when status === 'error'.
   * Null in all other states.
   */
  error: string | null
}

// ---------------------------------------------------------------------------
// IPC Payloads (Main → Renderer via push)
//
// Pushed from the Main process to the Renderer on every parsed line or
// session lifecycle transition.
// ---------------------------------------------------------------------------

/**
 * Payload for the serial:data push event.
 *
 * Carries a single parsed line of text from a serial session.
 * One-line-per-event for V0.1 — batching is deferred to a future
 * performance optimization based on profiling.
 *
 * The port field allows the Renderer to route the line to the correct
 * per-port log array in the Zustand store, supporting multi-board monitoring.
 *
 * Future: Serial Plotter / CSV Logger can consume ISerialDataPayload
 * directly from the push channel without changes to this type.
 */
export interface ISerialDataPayload {
  /** OS port path that produced this line */
  port: string

  /** A single complete parsed line (newline characters stripped) */
  line: string
}

/**
 * Payload for the serial:statusChanged push event.
 *
 * Pushed whenever a session transitions between lifecycle states:
 * opened, closed (graceful), or error (unexpected close).
 *
 * The Renderer updates the matching ISerialSessionState in Zustand.
 */
export interface ISerialStatusPayload {
  /** OS port path whose status changed */
  port: string

  /** New lifecycle status */
  status: SerialStatus

  /**
   * Human-readable error message when status === 'error'.
   * Null for all other statuses.
   */
  error: string | null
}

// ---------------------------------------------------------------------------
// Result types (returned by IPC invoke channels)
//
// Follow the same discriminated union convention as ICompileResult /
// IUploadResult in upload.ts. Callers branch on `status` without parsing
// the error string.
// ---------------------------------------------------------------------------

/**
 * Structured error codes for serial operation failures.
 *
 * Allows callers (IPC, Zustand, UI) to branch on error category without
 * parsing the user-facing message string.
 *
 * Future error codes (e.g. 'baud_rate_unsupported', 'framing_error') can
 * be added here without changing the ISerialResult shape.
 */
export type SerialErrorCode =
  | 'port_not_found' //       specified port does not exist
  | 'port_already_open' //    serial:open called for a port with an active session
  | 'port_not_open' //        serial:write or serial:close called with no active session
  | 'permission_denied' //    OS rejected open() due to insufficient permissions
  | 'port_busy' //            OS reported the port is in use by another process
  | 'write_failed' //         bytes could not be written to the port
  | 'unknown' //              catch-all for unexpected OS or serialport errors

/**
 * Result returned by serial:open, serial:close, and serial:write IPC channels.
 *
 * On success, no additional payload is returned — the session state is
 * communicated via serial:statusChanged push events.
 * On failure, a structured error code and a human-readable message are provided.
 */
export type ISerialResult =
  { status: 'success' } | { status: 'error'; code: SerialErrorCode; error: string }
