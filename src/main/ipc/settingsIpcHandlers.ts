/**
 * Settings IPC Handlers
 *
 * Registers all ipcMain handlers for the Settings subsystem (Phase 8,
 * Slice 35).
 *
 * Architectural rules:
 * - Completely separate from hardwareIpcHandlers.ts, uploadIpcHandlers.ts,
 *   serialIpcHandlers.ts, aiIpcHandlers.ts, and projectIpcHandlers.ts — the
 *   Settings domain is independent.
 * - This module owns the boundary between the Main process and the
 *   settings:* IPC layer.
 * - It NEVER accesses SettingsService internals directly — it delegates
 *   exclusively to SettingsService.getAiConfig() / .saveAiConfig(), the
 *   two public entry points relevant to the Renderer.
 * - It performs NO business logic, NO encryption, NO validation.
 * - It does NOT transform SettingsService results. Typed values cross the
 *   bridge exactly as returned.
 * - It never throws across the IPC boundary. SettingsService already
 *   guarantees typed results on all code paths and never throws.
 * - SettingsService.getResolvedAiSettings() is intentionally NEVER wired to
 *   a channel here — it is Main-process-only and is instead called from
 *   aiIpcHandlers.ts, the sole coordination point between the AI and
 *   Settings domains.
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to remove handlers on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   settings:getAiConfig  → SettingsService.getAiConfig()
 *   settings:saveAiConfig → SettingsService.saveAiConfig(request)
 *
 * No push events. No window reference is needed.
 *
 * Lifecycle:
 *   settingsIpcHandlers.register() — called once after app is ready.
 *   settingsIpcHandlers.remove()   — called on app quit or window close.
 */

import { ipcMain } from 'electron'
import { SettingsService } from '../services/SettingsService'
import { SettingsIpcChannels } from '@shared/types/ipc'
import type { IAiSettingsConfig, IAiSettingsSaveRequest, ISettingsSaveResult } from '@shared/types/settings'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the Settings subsystem.
 *
 * Must be called exactly once during app startup. No window reference is
 * needed — both channels are invoke/response only (no push events).
 */
function registerSettingsIpcHandlers(): void {
  // -------------------------------------------------------------------------
  // Invoke: settings:getAiConfig
  //
  // Returns the sanitized, Renderer-safe AI provider configuration. Never
  // includes the raw API key.
  // -------------------------------------------------------------------------
  ipcMain.handle(SettingsIpcChannels.getAiConfig, (): IAiSettingsConfig => {
    return SettingsService.getAiConfig()
  })

  // -------------------------------------------------------------------------
  // Invoke: settings:saveAiConfig
  //
  // Persists the given AI provider configuration. See
  // IAiSettingsSaveRequest.apiKey's doc comment for the
  // unchanged/clear/set semantics.
  // -------------------------------------------------------------------------
  ipcMain.handle(
    SettingsIpcChannels.saveAiConfig,
    (_event, request: IAiSettingsSaveRequest): ISettingsSaveResult => {
      return SettingsService.saveAiConfig(request)
    }
  )
}

/**
 * Removes all ipcMain handlers registered by this module.
 *
 * Must be called when the application is quitting to prevent stale handlers
 * from accumulating across hot-reloads in development.
 *
 * No additional cleanup is needed — the Settings subsystem has no
 * persistent sessions, open file handles, or OS-level resources to release.
 */
function removeSettingsIpcHandlers(): void {
  ipcMain.removeHandler(SettingsIpcChannels.getAiConfig)
  ipcMain.removeHandler(SettingsIpcChannels.saveAiConfig)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const settingsIpcHandlers = Object.freeze({
  register: registerSettingsIpcHandlers,
  remove: removeSettingsIpcHandlers
})
