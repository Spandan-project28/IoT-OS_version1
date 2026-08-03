/**
 * SettingsService
 *
 * Owns the persisted AI provider configuration: apiUrl, model, and an
 * encrypted API key (Phase 8, Slice 35).
 *
 * Architectural rules:
 * - This module owns the settings registry file and its read/write ONLY,
 *   mirroring RecentProjectsService's exact shape (Phase 7, Slice 28):
 *   app.getPath('userData'), synchronous best-effort read/write, no IPC
 *   coupling inside the service.
 * - It NEVER reads or writes a project file (that is ProjectService).
 * - It NEVER touches the workspace root (that is WorkspaceService).
 * - It NEVER calls AIService. Cross-service coordination (fetching resolved
 *   settings to pass into AIService.generate()) happens in aiIpcHandlers.ts,
 *   not here — this module has no knowledge that AIService exists.
 * - ISettingsFileDTO (the on-disk shape) is intentionally NOT defined in
 *   src/shared/types — it is a Main-process-only internal type declared
 *   here, mirroring IProjectFileDTO's precedent in ProjectService.ts. It
 *   carries an encrypted (never plaintext) API key.
 * - getAiConfig() never returns the raw API key — only hasApiKey.
 * - getResolvedAiSettings() returns the raw, decrypted API key and must
 *   only ever be called from Main-process code (aiIpcHandlers.ts). It must
 *   never be wired to any IPC channel.
 * - saveAiConfig() returns a typed result and never throws, matching the
 *   ICompileResult / IUploadResult / IAIResult / project-persistence
 *   convention used throughout the codebase. This is a deliberate deviation
 *   from RecentProjectsService's fire-and-forget push()/remove() — those are
 *   a "convenience registry, not the source of truth for any project's
 *   existence" (RecentProjectsService's own doc comment); saving AI
 *   settings is a direct, explicit user action expecting confirmation,
 *   matching ProjectService.save()'s contract instead.
 */

import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type {
  IAiSettingsConfig,
  IAiSettingsSaveRequest,
  ISettingsSaveResult,
  IResolvedAiSettings
} from '@shared/types/settings'

// ---------------------------------------------------------------------------
// On-disk DTO
//
// Main-process-only. Must never be added to src/shared/types — the Renderer
// must never see this shape, and in particular must never see
// encryptedApiKey even in its encrypted form.
// ---------------------------------------------------------------------------

interface ISettingsFileDTO {
  readonly apiUrl: string | null
  readonly model: string | null
  /** Base64-encoded Buffer returned by safeStorage.encryptString(). Null if no key is stored. */
  readonly encryptedApiKey: string | null
}

const DEFAULT_SETTINGS_FILE: ISettingsFileDTO = {
  apiUrl: null,
  model: null,
  encryptedApiKey: null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/**
 * Reads and parses the settings file.
 * Returns the safe default (all fields unset) if the file does not exist or
 * cannot be parsed — a corrupted or missing settings file must never crash
 * the app, matching RecentProjectsService.readRegistry()'s convention.
 */
function readSettingsFile(): ISettingsFileDTO {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as ISettingsFileDTO
    }
    return DEFAULT_SETTINGS_FILE
  } catch {
    return DEFAULT_SETTINGS_FILE
  }
}

/**
 * Writes the settings file. Throws on failure — saveAiConfig() catches this
 * and maps it to a typed 'write_failed' result. Unlike
 * RecentProjectsService.writeRegistry(), failures here are not swallowed:
 * saving settings is a direct user action expecting confirmation.
 */
function writeSettingsFile(dto: ISettingsFileDTO): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(dto, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the sanitized, Renderer-safe AI provider configuration.
 * Never includes the raw API key — only whether one is currently stored.
 */
function getAiConfig(): IAiSettingsConfig {
  const stored = readSettingsFile()
  return {
    apiUrl: stored.apiUrl,
    model: stored.model,
    hasApiKey: !!stored.encryptedApiKey
  }
}

/**
 * Saves the given AI provider configuration.
 *
 * apiKey handling:
 * - undefined: the existing stored key (if any) is left untouched.
 * - '' (empty string): the stored key is explicitly cleared.
 * - non-empty string: encrypted via safeStorage.encryptString() and stored,
 *   replacing any existing key.
 *
 * Fails closed: if a non-empty apiKey is provided but safeStorage encryption
 * is unavailable on this system, the key is never written in plaintext —
 * a typed 'encryption_unavailable' error is returned instead.
 *
 * Never throws.
 */
function saveAiConfig(request: IAiSettingsSaveRequest): ISettingsSaveResult {
  const existing = readSettingsFile()
  let encryptedApiKey = existing.encryptedApiKey

  if (request.apiKey !== undefined) {
    if (request.apiKey === '') {
      encryptedApiKey = null
    } else {
      if (!safeStorage.isEncryptionAvailable()) {
        return {
          status: 'error',
          code: 'encryption_unavailable',
          error:
            'Secure storage is not available on this system, so the API key could not be saved safely.'
        }
      }
      encryptedApiKey = safeStorage.encryptString(request.apiKey).toString('base64')
    }
  }

  const updated: ISettingsFileDTO = {
    apiUrl: request.apiUrl,
    model: request.model,
    encryptedApiKey
  }

  try {
    writeSettingsFile(updated)
    return { status: 'success' }
  } catch (err: unknown) {
    console.error('[SettingsService] Failed to write settings file:', err)
    return {
      status: 'error',
      code: 'write_failed',
      error: 'Failed to save settings to disk.'
    }
  }
}

/**
 * Returns the fully resolved AI settings, including the decrypted API key.
 *
 * Main-process-only — must never be wired to any IPC channel. Called
 * exclusively from aiIpcHandlers.ts, which passes the result into
 * AIService.generate() as an explicit parameter.
 *
 * Returns null when no API key is stored, or when stored but undecryptable
 * (encryption unavailable, or corrupted ciphertext) — in both cases the
 * caller falls back to environment variables / mock, exactly as if no
 * settings had ever been saved.
 */
function getResolvedAiSettings(): IResolvedAiSettings | null {
  const stored = readSettingsFile()

  if (!stored.encryptedApiKey) {
    return null
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.error(
      '[SettingsService] Encryption is unavailable — cannot decrypt the stored API key.'
    )
    return null
  }

  try {
    const apiKey = safeStorage.decryptString(Buffer.from(stored.encryptedApiKey, 'base64'))
    return {
      apiKey,
      apiUrl: stored.apiUrl,
      model: stored.model
    }
  } catch (err: unknown) {
    console.error('[SettingsService] Failed to decrypt the stored API key:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const SettingsService = Object.freeze({
  getAiConfig,
  saveAiConfig,
  getResolvedAiSettings
})
