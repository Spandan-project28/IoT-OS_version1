/**
 * settings.ts
 *
 * Shared type definitions for the Settings domain (Phase 8, Slice 35).
 *
 * This is the single source of truth for the settings:* IPC contract —
 * request/result shapes for reading and saving the persisted AI provider
 * configuration.
 *
 * Architectural rules:
 * - IResolvedAiSettings carries the raw, decrypted API key and is
 *   Main-process-only — it must never be transmitted to or accessible by
 *   the Renderer, mirroring the existing rule for IAIProviderConfig in
 *   ai.ts. It is produced by SettingsService and consumed only by
 *   AIService, via aiIpcHandlers.ts.
 * - IAiSettingsConfig (the Renderer-facing read shape) never carries the
 *   raw API key — only hasApiKey, a boolean.
 * - ISettingsSaveResult follows the existing never-reject IPC convention
 *   established by ICompileResult / IUploadResult / IAIResult / the
 *   project-persistence result types: a discriminated union on `status`,
 *   never a thrown/rejected error.
 *
 * Consumers:
 * - SettingsService     (Main process — produces IAiSettingsConfig / ISettingsSaveResult / IResolvedAiSettings)
 * - AIService            (Main process — consumes IResolvedAiSettings, passed in by aiIpcHandlers.ts)
 * - settingsIpcHandlers  (Main process — serialises IAiSettingsConfig / IAiSettingsSaveRequest / ISettingsSaveResult across the IPC boundary)
 * - Preload bridge       (types the window.api.settings surface)
 * - Zustand store        (stores IAiSettingsConfig in aiConfig)
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Structured error codes for settings persistence failures.
 *
 * Allows callers (IPC, Zustand, UI) to branch on error category without
 * parsing the user-facing message string — matches the ProjectErrorCode /
 * UploadErrorCode convention.
 */
export type SettingsErrorCode =
  | 'encryption_unavailable' // safeStorage.isEncryptionAvailable() is false; the API key was not saved
  | 'write_failed' //          writing settings.json to disk failed
  | 'unknown' //                catch-all for unexpected errors

// ---------------------------------------------------------------------------
// Read (settings:getAiConfig)
// ---------------------------------------------------------------------------

/**
 * Renderer-facing, sanitized view of the persisted AI provider configuration.
 *
 * Produced by SettingsService.getAiConfig() and returned by the
 * settings:getAiConfig invoke channel. Never carries the raw API key —
 * hasApiKey is the only signal of key presence.
 */
export interface IAiSettingsConfig {
  /** Persisted base URL for the provider's chat completions endpoint, or null if unset. */
  readonly apiUrl: string | null

  /** Persisted model identifier, or null if unset. */
  readonly model: string | null

  /** True if an API key is currently stored (encrypted) for this provider. */
  readonly hasApiKey: boolean
}

// ---------------------------------------------------------------------------
// Save (settings:saveAiConfig)
// ---------------------------------------------------------------------------

/**
 * Request payload for the settings:saveAiConfig invoke channel.
 *
 * apiKey has three distinct states, chosen deliberately over a `string | null`
 * field because two states (unchanged vs. explicit-clear) are not enough to
 * also represent "set a new value" without conflating it with one of the
 * other two:
 * - omitted (`undefined`): leave the previously stored key unchanged.
 * - empty string (`''`):   explicitly clear/remove the stored key.
 * - non-empty string:      replace the stored key with this value.
 */
export interface IAiSettingsSaveRequest {
  readonly apiUrl: string | null
  readonly model: string | null
  readonly apiKey?: string
}

/** Result of SettingsService.saveAiConfig(). */
export type ISettingsSaveResult =
  | { readonly status: 'success' }
  | { readonly status: 'error'; readonly code: SettingsErrorCode; readonly error: string }

// ---------------------------------------------------------------------------
// Resolved settings (Main-process-only)
// ---------------------------------------------------------------------------

/**
 * The persisted AI settings, fully resolved with the raw, decrypted API key.
 *
 * Main-process-only type. It must never be transmitted to or accessible by
 * the Renderer — mirrors IAIProviderConfig's existing rule in ai.ts.
 *
 * Produced by SettingsService.getResolvedAiSettings(). Consumed only by
 * AIService.generate(), passed in by aiIpcHandlers.ts — this is the sole
 * point of coordination between the Settings and AI domains, kept at the
 * IPC orchestration layer rather than as a direct service-to-service call.
 */
export interface IResolvedAiSettings {
  /** The decrypted API key. Never logged, never transmitted to the Renderer. */
  readonly apiKey: string

  /** Persisted base URL, or null if unset (falls back to AIService's default). */
  readonly apiUrl: string | null

  /** Persisted model identifier, or null if unset (falls back to AIService's default). */
  readonly model: string | null
}
