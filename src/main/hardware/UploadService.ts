/**
 * UploadService
 *
 * Responsible for compiling firmware source and uploading compiled firmware
 * to a connected board via the arduino-cli executable.
 *
 * Architectural rules:
 * - Single responsibility: compile and upload firmware only.
 * - Never communicates with the Renderer, IPC, or UI.
 * - Reads CLI availability from ArduinoCLIService.getState() only — never modifies it.
 * - Never throws to callers — all errors are returned as typed result objects.
 * - compile() owns temp directory creation and transfers ownership to ICompiledFirmware.
 * - upload() owns temp directory cleanup (always runs in finally block).
 * - All CLI subprocesses use child_process.spawn (not exec) to avoid stdout buffer
 *   limits on large firmware binaries.
 * - Every subprocess's command line, stdout, and stderr is streamed live to
 *   UploadEventBus as it is produced (Phase 10, Integrated Terminal) — never
 *   buffered until process exit. The full buffered text is still returned in
 *   the final result, since parseCompileError()/parseUploadError() need it.
 *
 * Public API:
 * - compile(request)          → ICompileResult    (produces compiled artifact)
 * - upload(firmware)          → IUploadResult     (consumes compiled artifact)
 * - compileAndUpload(request) → IUploadResult     (thin convenience wrapper)
 *
 * IPC integration: uploadIpcHandlers.ts (Phase 3, Slice 9) delegates all three
 * public methods to the Renderer via the upload:* invoke channels, and
 * forwards UploadEventBus's upload:log events via the upload:log push
 * channel (Phase 10).
 */

import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { ArduinoCLIService } from './ArduinoCLIService'
import { UploadEventBus } from './UploadEventBus'
import { SerialService } from '../serial/SerialService'
import type {
  IUploadRequest,
  ICompiledFirmware,
  ICompileResult,
  IUploadResult,
  UploadErrorCode
} from '@shared/types/upload'

// ---------------------------------------------------------------------------
// Private: subprocess execution
// ---------------------------------------------------------------------------

interface SpawnResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Emits a single Integrated Terminal log entry to UploadEventBus, stamped
 * with the moment it was produced. The IPC layer forwards this to the
 * Renderer in real time via the upload:log push channel — see
 * uploadIpcHandlers.ts.
 */
function emitLog(stream: 'command' | 'stdout' | 'stderr', text: string): void {
  UploadEventBus.emit('upload:log', { stream, text, timestamp: Date.now() })
}

/**
 * Formats a resolved executable path and its arguments for display in the
 * Integrated Terminal, e.g.:
 *   "C:\Program Files\Arduino CLI\arduino-cli.exe" compile --fqbn ... <dir>
 *
 * The executable is always quoted (it commonly contains spaces on Windows).
 * Arguments are quoted only when they themselves contain whitespace, so the
 * common case (flags, FQBNs, port names) reads cleanly.
 */
function formatCommandForDisplay(executable: string, args: string[]): string {
  const quotedArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
  return [`"${executable}"`, ...quotedArgs].join(' ')
}

/**
 * Runs a CLI command as a child process, collecting stdout and stderr.
 *
 * Uses spawn (not exec) to avoid the default 200KB stdout buffer limit,
 * which can be exceeded by verbose compiler output on large sketches.
 * `command` must always be the resolved absolute executable path from
 * ArduinoCLIService.getResolvedExecutablePath() — never the bare literal
 * "arduino-cli", which is not guaranteed to be on this process's inherited
 * PATH even when the CLI is installed and detected. No shell is used, so
 * args never need shell-quoting (important since the resolved path itself
 * commonly contains spaces, e.g. "C:\Program Files\Arduino CLI\arduino-cli.exe"),
 * and libuv still performs a PATH search on Windows for a bare command name.
 *
 * Every chunk is streamed live to UploadEventBus via emitLog() as it
 * arrives, in addition to being accumulated into the full buffered
 * stdout/stderr strings returned on completion — parseCompileError() and
 * parseUploadError() still need the complete text to pattern-match against.
 *
 * This function never rejects — process errors are converted to exit code 1.
 */
function runProcess(command: string, args: string[]): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      stdout += text
      emitLog('stdout', text)
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      stderr += text
      emitLog('stderr', text)
    })

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })

    proc.on('error', (err) => {
      // Handles ENOENT (command not found) and similar OS-level errors
      emitLog('stderr', err.message)
      resolve({ exitCode: 1, stdout: '', stderr: err.message })
    })
  })
}

// ---------------------------------------------------------------------------
// Private: error parsing
// ---------------------------------------------------------------------------

/**
 * Translates raw arduino-cli compile stderr into a structured error.
 * Patterns are matched in priority order — most specific first.
 */
function parseCompileError(stderr: string): { code: UploadErrorCode; error: string } {
  if (stderr.includes('Compilation error:')) {
    const match = stderr.match(/Compilation error:\s*(.+)/)
    const detail = match?.[1]?.trim() ?? 'check your firmware source for syntax errors'
    return { code: 'compile_failed', error: `Compilation failed: ${detail}` }
  }

  if (
    stderr.includes('missing core') ||
    stderr.includes('platform not installed') ||
    (stderr.includes('platform') && stderr.includes('not found'))
  ) {
    return {
      code: 'core_not_installed',
      error: 'Missing board core. Install the required platform via arduino-cli.'
    }
  }

  const firstLine = stderr
    .split('\n')
    .find((l) => l.trim().length > 0)
    ?.trim()

  return {
    code: 'unknown',
    error: `Unexpected error: ${firstLine ?? 'unknown compilation error'}`
  }
}

/**
 * Translates raw arduino-cli upload stderr into a structured error.
 * Patterns are matched in priority order — most specific first.
 */
function parseUploadError(stderr: string, port: string): { code: UploadErrorCode; error: string } {
  const lower = stderr.toLowerCase()

  if (
    lower.includes('no such port') ||
    lower.includes('port not found') ||
    lower.includes('cannot open') ||
    lower.includes('access is denied')
  ) {
    return {
      code: 'port_not_found',
      error: `Board not found on port ${port}. Is it connected?`
    }
  }

  if (lower.includes('an error occurred while uploading')) {
    return {
      code: 'upload_failed',
      error: 'Upload failed. Try pressing the reset button and uploading again.'
    }
  }

  if (lower.includes('missing core') || lower.includes('platform not installed')) {
    return {
      code: 'core_not_installed',
      error: 'Missing board core. Install the required platform via arduino-cli.'
    }
  }

  const firstLine = stderr
    .split('\n')
    .find((l) => l.trim().length > 0)
    ?.trim()

  return {
    code: 'unknown',
    error: `Unexpected error: ${firstLine ?? 'unknown upload error'}`
  }
}

// ---------------------------------------------------------------------------
// Private: pre-flight validation
// ---------------------------------------------------------------------------

/**
 * Validates that the CLI is available and the required board core is installed
 * before attempting any subprocess execution.
 *
 * Returns a structured error object if validation fails, or null if all checks pass.
 */
function runPreflight(request: IUploadRequest): { code: UploadErrorCode; error: string } | null {
  const cli = ArduinoCLIService.getState()

  if (!cli.isInstalled) {
    return {
      code: 'cli_not_found',
      error: 'arduino-cli not found. Ensure it is installed and available in PATH.'
    }
  }

  if (!request.fqbn || request.fqbn.trim().length === 0) {
    return {
      code: 'fqbn_missing',
      error: 'No FQBN specified. The board must have a valid FQBN to compile and upload firmware.'
    }
  }

  // Derive platform core prefix from FQBN (e.g. "arduino:avr:uno" → "arduino:avr")
  const parts = request.fqbn.split(':')
  if (parts.length >= 2) {
    const requiredCore = `${parts[0]}:${parts[1]}`
    if (!cli.installedCores.includes(requiredCore)) {
      return {
        code: 'core_not_installed',
        error: `Missing board core: "${requiredCore}". Install it via arduino-cli before uploading.`
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Private: temp directory helpers
// ---------------------------------------------------------------------------

const SKETCH_FOLDER_NAME = 'firmware'
const SKETCH_FILE_NAME = 'firmware.ino'

/**
 * Creates a uniquely named temporary build directory and writes the firmware
 * source into it with the directory structure required by arduino-cli:
 *
 *   <tmpdir>/iotosai-<uuid>/
 *     firmware/
 *       firmware.ino    ← arduino-cli requires dirname === filename (sans ext)
 *
 * Returns only the root build directory path. The sketch subdirectory is
 * always derivable as buildPath + SKETCH_FOLDER_NAME and is re-derived by
 * compile() at the point of use.
 */
async function createTempBuild(source: string): Promise<string> {
  const buildPath = path.join(os.tmpdir(), `iotosai-${randomUUID()}`)
  const sketchDir = path.join(buildPath, SKETCH_FOLDER_NAME)
  const sourceFile = path.join(sketchDir, SKETCH_FILE_NAME)

  await fs.mkdir(sketchDir, { recursive: true })
  await fs.writeFile(sourceFile, source, 'utf-8')

  return buildPath
}

/**
 * Removes the entire root temp build directory.
 * Errors are suppressed — cleanup failure must never mask the primary result.
 */
async function cleanupBuild(buildPath: string): Promise<void> {
  try {
    await fs.rm(buildPath, { recursive: true, force: true })
  } catch {
    // Intentionally suppressed — temp dir cleanup is best-effort
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles firmware source and returns a compiled artifact on success.
 *
 * On success:
 *   Returns { status: 'success', firmware: ICompiledFirmware }.
 *   Ownership of the temp build directory transfers to the returned artifact.
 *   The caller MUST pass the artifact to upload() to trigger cleanup.
 *
 * On failure:
 *   Cleans up the temp build directory before returning.
 *   Returns { status: 'error', code, error, raw } — never throws.
 */
async function compile(request: IUploadRequest): Promise<ICompileResult> {
  // Step 1: Pre-flight validation
  const preflightError = runPreflight(request)
  if (preflightError) {
    return { status: 'error', ...preflightError }
  }

  // Step 2: Create temp build directory and write source
  let buildPath: string
  try {
    buildPath = await createTempBuild(request.source)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create the build directory.'
    return { status: 'error', code: 'unknown', error: message }
  }
  const sketchDir = path.join(buildPath, SKETCH_FOLDER_NAME)

  // Step 3: Execute arduino-cli compile, via the resolved executable path —
  // never the bare "arduino-cli" literal, which is not guaranteed to be on
  // this process's inherited PATH (see ArduinoCLIService.resolveExecutable()).
  const executable = ArduinoCLIService.getResolvedExecutablePath()
  const compileArgs = ['compile', '--fqbn', request.fqbn, sketchDir]
  emitLog('command', formatCommandForDisplay(executable, compileArgs))
  const result = await runProcess(executable, compileArgs)

  if (result.exitCode === 0) {
    // Ownership of buildPath transfers to the artifact — do NOT clean up here
    return {
      status: 'success',
      firmware: {
        port: request.port,
        fqbn: request.fqbn,
        buildPath
      }
    }
  }

  // Compilation failed — clean up before returning error
  await cleanupBuild(buildPath)
  const { code, error } = parseCompileError(result.stderr)
  return { status: 'error', code, error, raw: result.stderr || undefined }
}

/**
 * Uploads a previously compiled firmware artifact to its target port.
 *
 * Takes the ICompiledFirmware produced by compile() — no recompilation occurs.
 * Always cleans up the artifact's buildPath in a finally block.
 * The artifact is SPENT after this call returns; do not reuse it.
 *
 * Never throws — all errors are returned as { status: 'error', code, error, raw }.
 */
async function upload(firmware: ICompiledFirmware): Promise<IUploadResult> {
  const sketchDir = path.join(firmware.buildPath, SKETCH_FOLDER_NAME)

  try {
    // Re-validate CLI is still available at upload time
    const cli = ArduinoCLIService.getState()
    if (!cli.isInstalled) {
      return {
        status: 'error',
        code: 'cli_not_found',
        error: 'arduino-cli not found. Ensure it is installed and available in PATH.'
      }
    }

    // If the Device Monitor holds an open serial connection on this port,
    // arduino-cli's uploader (esptool/avrdude) cannot open it — the OS only
    // allows one owner of a serial handle at a time. Arduino IDE closes the
    // Serial Monitor automatically before every upload for the same reason;
    // mirror that here so a forgotten-open monitor doesn't masquerade as a
    // board/cable problem.
    if (SerialService.hasSession(firmware.port)) {
      emitLog(
        'stdout',
        `Closing active Serial Monitor session on ${firmware.port} before upload...\n`
      )
      await SerialService.close(firmware.port)
    }

    const executable = ArduinoCLIService.getResolvedExecutablePath()
    const uploadArgs = ['upload', '-p', firmware.port, '--fqbn', firmware.fqbn, sketchDir]
    emitLog('command', formatCommandForDisplay(executable, uploadArgs))
    const result = await runProcess(executable, uploadArgs)

    if (result.exitCode === 0) {
      return { status: 'success' }
    }

    const { code, error } = parseUploadError(result.stderr, firmware.port)
    return { status: 'error', code, error, raw: result.stderr || undefined }
  } finally {
    // Always clean up — artifact is spent regardless of success or failure
    await cleanupBuild(firmware.buildPath)
  }
}

/**
 * Convenience wrapper: compile followed by upload.
 *
 * Stops and returns the compile error if compilation fails (no upload attempted).
 * Internally delegates entirely to compile() then upload() — contains no logic of its own.
 *
 * This is the primary entry point for the one-click upload workflow in V0.1.
 */
async function compileAndUpload(request: IUploadRequest): Promise<IUploadResult> {
  const compiled = await compile(request)

  if (compiled.status === 'error') {
    // ICompileResult error shape is structurally identical to IUploadResult error shape
    return compiled
  }

  return upload(compiled.firmware)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const UploadService = Object.freeze({
  compile,
  upload,
  compileAndUpload
})
