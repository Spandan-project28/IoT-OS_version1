/**
 * BoardIdentificationService
 *
 * Responsible for identifying connected serial ports as known board models.
 *
 * Architectural rules:
 * - Single responsibility: translating ISerialPort → IIdentificationResult only.
 * - Consumes HardwareRegistry (VID/PID lookups) and SerialPortService (port list).
 * - Owns its internal identification result list state.
 * - Never guesses when multiple candidates match — ambiguity is preserved explicitly.
 * - Never communicates with the Renderer, IPC, or UI.
 * - Never opens ports, compiles, or uploads anything.
 * - Stateless in its logic — the same inputs always produce the same outputs.
 *
 * Disambiguation strategy:
 *   Primary:   HardwareRegistry.findBoardsByVidPid() — exact VID/PID match.
 *   Secondary: Manufacturer string heuristics applied when multiple candidates share
 *              a VID/PID (e.g. CH340 shared by Nano clone and ESP32 clone).
 *   Fallback:  `ambiguous` result returned — the system never guesses.
 *
 * Future consumers:
 * - HardwareManager  (reads identified boards to assemble IHardwareState)
 * - IPC handlers     (Slice 5) — exposes results to Renderer
 * - Zustand store    (Slice 6) — drives UI board state
 */

import { HardwareRegistry } from './HardwareRegistry'
import { SerialPortService } from './SerialPortService'
import type { IIdentificationResult, IBoard } from '@shared/types/hardware'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * The most recently computed identification results.
 * Updated each time identify() is called.
 */
let _results: IIdentificationResult[] = []

// ---------------------------------------------------------------------------
// Private helpers — disambiguation heuristics
// ---------------------------------------------------------------------------

/**
 * Manufacturer string tokens associated with CH340-based boards.
 * The CH340 chip (QinHeng Electronics) exposes a recognisable manufacturer
 * string on Windows and Linux that can disambiguate Nano vs ESP32 clones.
 */
const CH340_MANUFACTURER_TOKENS = ['qinheng', 'ch340', 'ch341', 'wch.cn']

/**
 * Manufacturer string tokens associated with Silicon Labs CP210x boards.
 * CP210x is the bridge used on official ESP32 DevKit boards.
 */
const CP210X_MANUFACTURER_TOKENS = ['silicon labs', 'silabs', 'cp210']

/**
 * Manufacturer string tokens associated with FTDI bridges.
 * FTDI FT232 is used on official Arduino Nano boards.
 */
const FTDI_MANUFACTURER_TOKENS = ['ftdi', 'future technology', 'ft232']

/**
 * Attempts to resolve ambiguity between multiple candidates using
 * the manufacturer string reported by the OS.
 *
 * Matching is case-insensitive and uses substring/token checks.
 * Returns a single resolved candidate, or null if disambiguation fails.
 *
 * @param candidates - The set of matching board definitions
 * @param manufacturer - The raw manufacturer string from the OS (may be undefined)
 */
function resolveByManufacturer(
  candidates: ReturnType<typeof HardwareRegistry.findBoardsByVidPid>,
  manufacturer: string | undefined
): (typeof candidates)[number] | null {
  if (!manufacturer) return null

  const mfr = manufacturer.toLowerCase()

  // CP210x → likely ESP32 DevKit (official)
  if (CP210X_MANUFACTURER_TOKENS.some((t) => mfr.includes(t))) {
    const match = candidates.find((c) => c.id === 'esp32-devkit')
    if (match) return match
  }

  // FTDI → likely official Arduino Nano
  if (FTDI_MANUFACTURER_TOKENS.some((t) => mfr.includes(t))) {
    const match = candidates.find((c) => c.id === 'arduino-nano')
    if (match) return match
  }

  // CH340 alone is insufficient — both Nano clones and ESP32 clones use it.
  // We log the token match but do not pick a winner.
  if (CH340_MANUFACTURER_TOKENS.some((t) => mfr.includes(t))) {
    return null // Cannot disambiguate CH340 by manufacturer string alone
  }

  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Identifies all currently known serial ports against the HardwareRegistry.
 *
 * For each port, three outcomes are possible:
 *  - `identified`  — exactly one registry match, or manufacturer string resolved ambiguity.
 *  - `ambiguous`   — multiple candidates remain after all heuristics are exhausted.
 *  - `unknown`     — no registry entry matched the VID/PID.
 *
 * Results are stored internally and also returned directly.
 * Call getPorts() from SerialPortService first to ensure the port list is current,
 * or call this after the HardwareManager triggers a refresh (Slice 4).
 */
function identify(): IIdentificationResult[] {
  const ports = SerialPortService.getPorts()

  _results = ports.map((port): IIdentificationResult => {
    const candidates = HardwareRegistry.findBoardsByVidPid(port.vendorId, port.productId)

    // No registry match — unsupported device
    if (candidates.length === 0) {
      return { status: 'unknown', port }
    }

    // Single unambiguous match
    if (candidates.length === 1) {
      const board: IBoard = { ...candidates[0], port: port.path }
      return { status: 'identified', board }
    }

    // Multiple candidates — attempt secondary disambiguation
    const resolved = resolveByManufacturer(candidates, port.manufacturer)

    if (resolved) {
      const board: IBoard = { ...resolved, port: port.path }
      return { status: 'identified', board }
    }

    // Ambiguity cannot be resolved — preserve all candidates, do not guess
    return { status: 'ambiguous', port, candidates }
  })

  return [..._results]
}

/**
 * Returns a shallow copy of the last computed identification results.
 * Returns an empty array if identify() has never been called.
 */
function getResults(): IIdentificationResult[] {
  return [..._results]
}

/**
 * Returns only the `identified` results as a flat list of IBoard objects.
 * Ambiguous and unknown results are excluded.
 *
 * This is the method HardwareManager will call to build the `connectedBoards`
 * list inside IHardwareState.
 */
function getIdentifiedBoards(): IBoard[] {
  return _results
    .filter(
      (r): r is Extract<IIdentificationResult, { status: 'identified' }> =>
        r.status === 'identified'
    )
    .map((r) => r.board)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const BoardIdentificationService = Object.freeze({
  identify,
  getResults,
  getIdentifiedBoards
})
