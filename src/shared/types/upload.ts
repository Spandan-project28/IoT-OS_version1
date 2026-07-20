/**
 * upload.ts
 *
 * Shared type definitions for the Upload domain.
 *
 * Intentionally separated from hardware.ts to keep each domain
 * self-contained as additional domains (Upload, Serial, AI) are introduced.
 *
 * Consumers:
 * - UploadService       (Main process — produces and consumes all types here)
 * - IPC handlers        (Slice 9 — serialises IUploadResult across the bridge)
 * - Zustand store       (Slice 10 — stores IUploadResult in renderer state)
 */

/**
 * Input contract for a compile operation.
 * Naming is intentionally generic — not Arduino-specific —
 * to accommodate future CLI toolchains (e.g. ESP-IDF, PlatformIO).
 */
export interface IUploadRequest {
  /** Serial port the board is connected to (e.g. "COM3", "/dev/ttyUSB0") */
  port: string
  /** CLI Fully Qualified Board Name (e.g. "arduino:avr:uno", "esp32:esp32:esp32") */
  fqbn: string
  /** Raw firmware source code as a plain string */
  source: string
}

/**
 * Intermediate compiled firmware artifact produced by UploadService.compile().
 *
 * Carries everything upload() needs to push firmware to a board.
 * Holds a reference to the temporary build directory on disk — this directory
 * is owned by this artifact and MUST be consumed by upload(), which cleans it up.
 *
 * Ownership rules:
 * - compile() creates buildPath and transfers ownership to the caller on success.
 * - upload() consumes buildPath and cleans it up in its finally block.
 * - The artifact is considered SPENT after upload() returns.
 * - If compile() fails, the temp directory is cleaned up before returning the error.
 *
 * Design intent: compile once, upload to any number of ports in future workflows.
 * For V0.1 the artifact is always consumed immediately by compileAndUpload().
 */
export interface ICompiledFirmware {
  /** Target port from the original compile request */
  port: string
  /** FQBN from the original compile request */
  fqbn: string
  /**
   * Absolute path to the root temporary build directory (e.g. /tmp/iotosai-<uuid>).
   * Internal implementation detail — opaque to IPC and UI layers.
   * upload() resolves the sketch subdirectory from this path at runtime.
   */
  buildPath: string
}

/**
 * Structured error codes for compile and upload failures.
 *
 * Allows callers (IPC, Zustand, UI) to branch on error category
 * without parsing the user-facing message string.
 */
export type UploadErrorCode =
  | 'cli_not_found' //      arduino-cli binary not in PATH
  | 'core_not_installed' // required board core missing (e.g. arduino:avr)
  | 'fqbn_missing' //       board has no FQBN defined in registry
  | 'compile_failed' //     compilation errors in firmware source
  | 'port_not_found' //     specified port does not exist or board not present
  | 'upload_failed' //      upload rejected by board (e.g. wrong bootloader)
  | 'unknown' //            catch-all for unrecognised CLI errors

/**
 * Result of UploadService.compile().
 *
 * On success, carries the ICompiledFirmware artifact to pass to upload().
 * On failure, temp directory is already cleaned up before this is returned.
 */
export type ICompileResult =
  | { status: 'success'; firmware: ICompiledFirmware }
  | { status: 'error'; code: UploadErrorCode; error: string; raw?: string }

/**
 * Result of UploadService.upload() and UploadService.compileAndUpload().
 *
 * Separate named type from ICompileResult to allow future divergence
 * (e.g. ICompileResult adding a binary output path or warning list).
 */
export type IUploadResult =
  { status: 'success' } | { status: 'error'; code: UploadErrorCode; error: string; raw?: string }
