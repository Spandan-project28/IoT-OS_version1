/**
 * SerialParser
 *
 * Defines the ISerialParser abstraction and provides the default
 * ReadlineSerialParser implementation.
 *
 * Architectural rules:
 * - ISerialParser is an interface — SerialSession depends on the abstraction,
 *   not on any specific parser implementation.
 * - This prevents tight coupling to ReadlineParser and allows future support
 *   for raw binary streams, JSON-framed streams, COBS, or custom protocols.
 * - All implementations must emit complete, decoded string "lines" — the
 *   definition of a "line" is an implementation detail of each parser.
 * - Parsers are stateful stream processors — they are created once per
 *   SerialSession and discarded when the session closes.
 * - The factory function pattern is used so SerialSession does not need
 *   to know how to construct a specific parser.
 *
 * Default implementation:
 *   ReadlineSerialParser wraps @serialport/parser-readline.
 *   It splits incoming bytes on '\n' and strips trailing '\r' automatically.
 *   This covers the vast majority of Arduino Serial.println() use cases.
 *
 * Future implementations (out of scope for V0.1):
 *   BinarySerialParser   — emits fixed-length byte frames
 *   JsonSerialParser     — emits complete JSON objects
 *   RegexSerialParser    — emits matches of a user-supplied pattern
 */

import { ReadlineParser } from '@serialport/parser-readline'
import type { SerialPort } from 'serialport'

// ---------------------------------------------------------------------------
// ISerialParser — the abstraction SerialSession depends on
// ---------------------------------------------------------------------------

/**
 * Abstraction for a streaming serial data parser.
 *
 * A parser is responsible for:
 * - Accepting raw byte chunks from a SerialPort stream (via pipe or manual push).
 * - Accumulating partial data until a complete "line" or "frame" is available.
 * - Emitting complete decoded strings to the registered line callback.
 * - Cleaning up internal state when close() is called.
 *
 * Implementations must be stream-safe — they will receive chunks of arbitrary
 * size from the OS and must handle partial lines correctly.
 */
export interface ISerialParser {
  /**
   * Attaches the parser to an open SerialPort instance.
   *
   * Called once immediately after the port is opened.
   * The parser should set up its internal stream pipeline here.
   *
   * @param port - The open SerialPort to read from.
   */
  attach(port: SerialPort): void

  /**
   * Registers the callback that will be invoked with each complete parsed line.
   *
   * The callback is called synchronously within the stream data event.
   * Implementations must guarantee that `line` contains no newline characters.
   *
   * @param callback - Receives each complete decoded line.
   */
  onLine(callback: (line: string) => void): void

  /**
   * Tears down the parser and releases any internal resources.
   *
   * Called by SerialSession.close() before the port is destroyed.
   * After close(), no further line callbacks will be invoked.
   */
  close(): void
}

// ---------------------------------------------------------------------------
// ReadlineSerialParser — the default implementation
// ---------------------------------------------------------------------------

/**
 * The default ISerialParser implementation.
 *
 * Wraps @serialport/parser-readline, which splits the incoming byte stream
 * on newline characters ('\n') and strips trailing '\r' automatically.
 * This is compatible with all Arduino Serial.println() output, which
 * terminates each line with '\r\n'.
 *
 * The delimiter can be configured at construction time to support boards
 * that use non-standard line endings, though '\n' covers >99% of cases.
 */
export class ReadlineSerialParser implements ISerialParser {
  private readonly _delimiter: string
  private _parser: ReadlineParser | null = null
  private _lineCallback: ((line: string) => void) | null = null

  /**
   * @param delimiter - The byte sequence that marks the end of a line.
   *   Defaults to '\n', which handles both '\n' and '\r\n' terminations.
   */
  constructor(delimiter: string = '\n') {
    this._delimiter = delimiter
  }

  /**
   * Attaches a ReadlineParser to the port stream via pipe().
   * The parser emits 'data' events with complete decoded lines.
   */
  attach(port: SerialPort): void {
    this._parser = new ReadlineParser({ delimiter: this._delimiter })

    // pipe() connects the port's readable stream to the parser's writable side
    port.pipe(this._parser)

    this._parser.on('data', (line: string) => {
      // Strip any trailing '\r' that ReadlineParser may not have consumed
      // (e.g. when receiving '\r\n' on a non-Windows platform).
      const clean = line.replace(/\r$/, '')
      if (this._lineCallback) {
        this._lineCallback(clean)
      }
    })
  }

  /**
   * Registers the callback to receive each complete parsed line.
   * Must be called before or immediately after attach().
   */
  onLine(callback: (line: string) => void): void {
    this._lineCallback = callback
  }

  /**
   * Removes all listeners from the parser and nulls internal references.
   * After close(), no further callbacks will be invoked.
   */
  close(): void {
    if (this._parser) {
      this._parser.removeAllListeners()
      this._parser = null
    }
    this._lineCallback = null
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a new ReadlineSerialParser with default settings.
 *
 * This is the factory function used by SerialSession when no custom
 * parser has been injected. Using a factory rather than a direct
 * `new ReadlineSerialParser()` call in SerialSession keeps the
 * session testable without importing this module directly.
 */
export function createDefaultParser(): ISerialParser {
  return new ReadlineSerialParser()
}
