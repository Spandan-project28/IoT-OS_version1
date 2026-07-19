/**
 * ArduinoCLIService
 *
 * Responsible for detecting the arduino-cli executable, reading its version,
 * and querying the list of installed board cores.
 *
 * Architectural rules:
 * - Single responsibility: CLI health checks only.
 * - Owns its internal state (IArduinoCLI). HardwareManager reads this state.
 * - Never communicates with the Renderer, IPC, or UI.
 * - Never performs uploads or compilation — those belong to UploadService (Phase 3).
 * - All operations are asynchronous and non-blocking.
 * - All errors are caught and translated to structured state — never thrown to callers.
 *
 * Future consumers:
 * - HardwareManager  (reads cli state to assemble IHardwareState snapshots)
 * - UploadService    (reads isInstalled + installedCores before allowing uploads)
 * - AIService        (reads installedCores for firmware generation context)
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import type { IArduinoCLI } from '@shared/types/hardware'

const execAsync = promisify(exec)

// ---------------------------------------------------------------------------
// Minimum supported CLI version
// ---------------------------------------------------------------------------

/**
 * Minimum arduino-cli version required by IoTOS AI.
 * Versions below this may lack JSON output support or board-core commands.
 * Expressed as [major, minor, patch].
 */
const MIN_CLI_VERSION: [number, number, number] = [0, 35, 0]

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * The current known state of the arduino-cli environment.
 * Initialised to a safe "unknown / not installed" value.
 * Updated each time refresh() is called.
 */
let _state: IArduinoCLI = {
  isInstalled: false,
  version: null,
  installedCores: []
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Parses a semantic version string like "1.2.3" into a numeric tuple.
 * Returns null if the string cannot be parsed.
 */
function parseVersion(raw: string): [number, number, number] | null {
  const match = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
}

/**
 * Returns true if `candidate` is at or above `minimum`.
 */
function isVersionSupported(
  candidate: [number, number, number],
  minimum: [number, number, number]
): boolean {
  for (let i = 0; i < 3; i++) {
    if (candidate[i] > minimum[i]) return true
    if (candidate[i] < minimum[i]) return false
  }
  return true // equal
}

/**
 * Runs `arduino-cli version --format json` and extracts the version string.
 * Returns null on any execution failure.
 */
async function detectVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('arduino-cli version --format json', {
      timeout: 5000
    })
    // Expected JSON: {"VersionString":"1.2.3","Commit":"...","Status":"..."}
    const parsed = JSON.parse(stdout.trim()) as { VersionString?: string }
    return parsed.VersionString ?? null
  } catch {
    // CLI not in PATH, or JSON parsing failed
    return null
  }
}

/**
 * Runs `arduino-cli core list --format json` and extracts installed core IDs.
 * Returns an empty array on any execution failure.
 *
 * Each entry in the returned array is a platform ID string,
 * e.g. "arduino:avr" or "esp32:esp32".
 */
async function detectInstalledCores(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('arduino-cli core list --format json', {
      timeout: 8000
    })

    // The JSON structure changed across CLI versions.
    // v1.x returns: { "platforms": [...] }
    // v0.x returns: [ ... ] (bare array)
    const raw = JSON.parse(stdout.trim()) as
      { platforms?: Array<{ id?: string }> } | Array<{ id?: string }>

    const platforms: Array<{ id?: string }> = Array.isArray(raw) ? raw : (raw.platforms ?? [])

    return platforms.map((p) => p.id ?? '').filter(Boolean)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Queries the arduino-cli executable and refreshes internal state.
 *
 * Steps performed:
 * 1. Detect CLI version via `arduino-cli version --format json`.
 * 2. Validate that the version meets the minimum requirement.
 * 3. If valid, query installed cores via `arduino-cli core list --format json`.
 *
 * After this call, getState() will reflect the latest discovered state.
 * This method never throws — all errors are captured in the returned state.
 */
async function refresh(): Promise<IArduinoCLI> {
  const rawVersion = await detectVersion()

  if (!rawVersion) {
    _state = {
      isInstalled: false,
      version: null,
      installedCores: [],
      error: 'arduino-cli not found. Ensure it is installed and available in PATH.'
    }
    return _state
  }

  const parsed = parseVersion(rawVersion)

  if (!parsed || !isVersionSupported(parsed, MIN_CLI_VERSION)) {
    _state = {
      isInstalled: false,
      version: rawVersion,
      installedCores: [],
      error: `arduino-cli version ${rawVersion} is below the minimum required version ${MIN_CLI_VERSION.join('.')}.`
    }
    return _state
  }

  const installedCores = await detectInstalledCores()

  _state = {
    isInstalled: true,
    version: rawVersion,
    installedCores
  }

  return _state
}

/**
 * Returns the last known CLI state without executing any processes.
 * Call refresh() first to obtain an up-to-date result.
 */
function getState(): IArduinoCLI {
  return { ..._state, installedCores: [..._state.installedCores] }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const ArduinoCLIService = Object.freeze({
  refresh,
  getState
})
