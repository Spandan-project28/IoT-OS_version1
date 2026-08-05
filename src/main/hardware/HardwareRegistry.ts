/**
 * HardwareRegistry
 *
 * The single source of truth for all supported board definitions in IoTOS AI.
 *
 * Architectural rules:
 * - This module is purely static metadata. It has no runtime state.
 * - It contains no business logic, no serial port code, no IPC, no UI logic.
 * - No other part of the application may define board VID/PID mappings.
 * - All VID/PID values are lowercase hex strings for consistent comparison.
 * - Future boards are added here only — no other file changes required.
 *
 * Consumers:
 * - BoardIdentificationService  (VID/PID lookup)
 * - UploadService               (FQBN for arduino-cli compile/upload)
 * - AIService                   (board type + chip family for prompt context)
 * - UI components               (display name, manufacturer)
 */

import type { IBoardDefinition } from '@shared/types/hardware'

// ---------------------------------------------------------------------------
// Board Registry — immutable at runtime via Object.freeze
// ---------------------------------------------------------------------------

/**
 * The canonical set of supported boards for IoTOS AI Prototype V0.1.
 *
 * VID/PID notes:
 *  - Arduino Uno R3 official: VID 0x2341 PID 0x0043 (USB CDC)
 *  - Arduino Uno R3 official DFU: VID 0x2341 PID 0x0001
 *  - Arduino Nano official (FTDI FT232): VID 0x0403 PID 0x6001
 *  - Arduino Nano clone (CH340G): VID 0x1a86 PID 0x7523
 *  - ESP32 DevKit (CP210x): VID 0x10c4 PID 0xea60
 *  - ESP32 DevKit clone (CH340): VID 0x1a86 PID 0x7523
 *
 * The CH340 VID/PID (0x1a86 / 0x7523) is shared between Nano clones and
 * ESP32 clones. The registry intentionally returns ALL candidates for this
 * pair via findBoardsByVidPid(). BoardIdentificationService is responsible
 * for resolving the ambiguity using secondary heuristics (manufacturer string,
 * product name, etc.). The registry never guesses — correctness is preserved.
 */
const BOARD_REGISTRY: readonly IBoardDefinition[] = Object.freeze([
  // -------------------------------------------------------------------------
  // Arduino Uno
  // -------------------------------------------------------------------------
  Object.freeze<IBoardDefinition>({
    id: 'arduino-uno',
    name: 'Arduino Uno',
    type: 'arduino',
    manufacturer: 'Arduino',
    chipFamily: 'AVR ATmega328P',
    protocol: 'ATmega16U2 (USB-CDC)',
    fqbn: 'arduino:avr:uno',
    identifiers: [
      { vid: '0x2341', pid: '0x0043' },
      { vid: '0x2341', pid: '0x0001' },
      { vid: '0x2341', pid: '0x0243' }
    ],
    capabilities: Object.freeze({
      arduinoCli: true,
      serialMonitor: true,
      ota: false
    })
  }),

  // -------------------------------------------------------------------------
  // Arduino Nano
  // -------------------------------------------------------------------------
  Object.freeze<IBoardDefinition>({
    id: 'arduino-nano',
    name: 'Arduino Nano',
    type: 'arduino',
    manufacturer: 'Arduino',
    chipFamily: 'AVR ATmega328P',
    // Nano uses FTDI on official boards and CH340G on common clones
    protocol: 'FTDI FT232 / CH340G',
    fqbn: 'arduino:avr:nano',
    identifiers: [
      { vid: '0x0403', pid: '0x6001' },
      { vid: '0x1a86', pid: '0x7523' }
    ],
    capabilities: Object.freeze({
      arduinoCli: true,
      serialMonitor: true,
      ota: false
    })
  }),

  // -------------------------------------------------------------------------
  // ESP32 DevKit V1
  // -------------------------------------------------------------------------
  Object.freeze<IBoardDefinition>({
    id: 'esp32-devkit',
    name: 'ESP32 DevKit',
    type: 'esp32',
    manufacturer: 'Espressif Systems',
    chipFamily: 'Xtensa LX6 (ESP32)',
    // Official DevKit uses CP210x; most clones use CH340
    protocol: 'Silicon Labs CP210x / CH340',
    fqbn: 'esp32:esp32:esp32',
    identifiers: [
      { vid: '0x10c4', pid: '0xea60' },
      { vid: '0x1a86', pid: '0x7523' }
    ],
    capabilities: Object.freeze({
      arduinoCli: true,
      serialMonitor: true,
      ota: false
    })
  })
])

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a raw hex string from the OS into a consistent lowercase
 * '0x'-prefixed format for reliable comparison.
 *
 * Examples:
 *   '2341'   → '0x2341'
 *   '0X2341' → '0x2341'
 *   '0x2341' → '0x2341'
 */
function normaliseHex(hex: string): string {
  return '0x' + hex.toLowerCase().replace(/^0x/, '')
}

// ---------------------------------------------------------------------------
// Public API — deterministic, side-effect free, read-only
// ---------------------------------------------------------------------------

/**
 * Returns a shallow copy of all board definitions.
 * The original registry remains immutable.
 */
function getAllBoards(): IBoardDefinition[] {
  return [...BOARD_REGISTRY]
}

/**
 * Finds a board definition by its stable identifier.
 *
 * @param id - The board id (e.g. 'arduino-uno')
 * @returns The matching board definition or undefined
 */
function getBoardById(id: string): IBoardDefinition | undefined {
  return BOARD_REGISTRY.find((board) => board.id === id)
}

/**
 * Returns ALL board definitions that declare an explicit (VID, PID) pair
 * matching the given values. An empty array means no supported board was found.
 *
 * This is the canonical VID/PID lookup method. Because multiple boards
 * can share the same VID/PID combination (e.g. CH340 clones of both
 * Arduino Nano and ESP32 DevKit both report VID 0x1A86 / PID 0x7523),
 * this method intentionally returns every candidate rather than
 * picking one arbitrarily.
 *
 * VID and PID are matched only as a bound pair from a board's `identifiers`
 * list — never as independent sets — so a board is never matched via a
 * VID/PID combination it did not explicitly declare.
 *
 * BoardIdentificationService is responsible for resolving ambiguity
 * using secondary heuristics (manufacturer string, product name, etc.).
 *
 * @param vendorId  - The USB Vendor ID reported by the OS (e.g. '2341', '0x2341')
 * @param productId - The USB Product ID reported by the OS (e.g. '7523', '0x7523')
 * @returns Array of all matching board definitions (may be empty, one, or many)
 */
function findBoardsByVidPid(
  vendorId: string | undefined,
  productId: string | undefined
): IBoardDefinition[] {
  if (!vendorId || !productId) return []

  const normVid = normaliseHex(vendorId)
  const normPid = normaliseHex(productId)

  return BOARD_REGISTRY.filter((board) =>
    board.identifiers.some(
      (pair) => normaliseHex(pair.vid) === normVid && normaliseHex(pair.pid) === normPid
    )
  )
}

/**
 * Returns a board definition only when the VID/PID match is unambiguous
 * (exactly one candidate exists in the registry).
 *
 * Returns undefined in three situations:
 *  - No parameters provided.
 *  - No registry entry matches.
 *  - Multiple registry entries match (ambiguous — do not guess).
 *
 * Use findBoardsByVidPid() to obtain the full candidate list when
 * disambiguation via secondary heuristics is required.
 *
 * @param vendorId  - The USB Vendor ID reported by the OS
 * @param productId - The USB Product ID reported by the OS
 * @returns The single unambiguous board definition, or undefined
 */
function findBoardByVidPid(
  vendorId: string | undefined,
  productId: string | undefined
): IBoardDefinition | undefined {
  const candidates = findBoardsByVidPid(vendorId, productId)
  // Only return a result when the match is certain — never pick arbitrarily
  return candidates.length === 1 ? candidates[0] : undefined
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const HardwareRegistry = Object.freeze({
  getAllBoards,
  getBoardById,
  findBoardsByVidPid,
  findBoardByVidPid
})
