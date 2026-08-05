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

/**
 * Common Windows installation locations for arduino-cli, checked in order
 * when the executable cannot be found via the process's inherited PATH.
 *
 * This exists because arduino-cli's installer registers its directory in
 * the Machine/User PATH environment variable at the OS level, but a
 * long-running process (like this Electron app) only inherits PATH once,
 * at spawn time — it never re-reads the registry. If arduino-cli was
 * installed after this process started, PATH-based resolution fails even
 * though the CLI is genuinely present and working.
 */
const COMMON_INSTALL_PATHS: readonly string[] = [
  'C:\\Program Files\\Arduino CLI\\arduino-cli.exe',
  'C:\\Program Files (x86)\\Arduino CLI\\arduino-cli.exe'
]

/**
 * The executable path used for every arduino-cli invocation. Starts as the
 * bare command name (resolved via PATH) and is upgraded to an absolute path
 * the first time resolveExecutable() finds arduino-cli via the fallback
 * search below. Cached across refresh() calls so a successful fallback
 * resolution is not re-searched from scratch every time.
 */
let _resolvedExecutable = 'arduino-cli'

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
    const { stdout } = await execAsync(`"${_resolvedExecutable}" version --format json`, {
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
    const { stdout } = await execAsync(`"${_resolvedExecutable}" core list --format json`, {
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

/**
 * Resolves which arduino-cli executable to use, in priority order:
 *   1. A previously resolved executable, if it still works (cache reuse).
 *   2. The bare "arduino-cli" command, relying on the process's inherited PATH.
 *   3. Common Windows installation paths (COMMON_INSTALL_PATHS above).
 *
 * Returns 'arduino-cli' (the bare command) if nothing is found anywhere, so
 * downstream error messages continue to read naturally ("arduino-cli not
 * found ... in PATH").
 */
async function resolveExecutable(): Promise<string> {
  if (_resolvedExecutable !== 'arduino-cli') {
    try {
      await execAsync(`"${_resolvedExecutable}" version`, { timeout: 5000 })
      return _resolvedExecutable
    } catch {
      // Previously resolved path no longer works — re-resolve from scratch.
    }
  }

  try {
    await execAsync('arduino-cli version', { timeout: 5000 })
    return 'arduino-cli'
  } catch {
    // Not found via PATH — fall through to common install paths.
  }

  for (const candidate of COMMON_INSTALL_PATHS) {
    try {
      await execAsync(`"${candidate}" version`, { timeout: 5000 })
      return candidate
    } catch {
      continue
    }
  }

  return 'arduino-cli'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Queries the arduino-cli executable and refreshes internal state.
 *
 * Steps performed:
 * 1. Resolve which executable to use (PATH, or a common install path fallback).
 * 2. Detect CLI version via `<resolved> version --format json`.
 * 3. Validate that the version meets the minimum requirement.
 * 4. If valid, query installed cores via `<resolved> core list --format json`.
 *
 * After this call, getState() will reflect the latest discovered state.
 * This method never throws — all errors are captured in the returned state.
 */
async function refresh(): Promise<IArduinoCLI> {
  _resolvedExecutable = await resolveExecutable()
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

/**
 * Returns the actual executable path/command that refresh() resolved and
 * verified working (an absolute path from COMMON_INSTALL_PATHS, or the bare
 * "arduino-cli" command if it resolves via the process's inherited PATH).
 *
 * This is the ONLY value any other module (e.g. UploadService) may pass to
 * spawn/exec/execFile to invoke the CLI — never the literal string
 * "arduino-cli", which is not guaranteed to be on PATH even when the CLI is
 * installed and detected (see resolveExecutable()'s fallback search above).
 */
function getResolvedExecutablePath(): string {
  return _resolvedExecutable
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const ArduinoCLIService = Object.freeze({
  refresh,
  getState,
  getResolvedExecutablePath
})
