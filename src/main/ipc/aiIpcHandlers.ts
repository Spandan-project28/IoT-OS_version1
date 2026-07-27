/**
 * AI IPC Handlers
 *
 * Registers all ipcMain handlers for the AI firmware generation subsystem.
 *
 * Architectural rules:
 * - Completely separate from hardwareIpcHandlers.ts, uploadIpcHandlers.ts,
 *   and serialIpcHandlers.ts — the AI generation domain is independent.
 * - This module owns the boundary between the Main process and the AI IPC layer.
 * - It NEVER accesses AIService internals directly — it delegates exclusively
 *   to AIService.generate(), the single public entry point.
 * - It performs NO business logic, NO validation, NO parsing, NO mapping.
 *   All of those responsibilities belong to AIService and its pipeline.
 * - It does NOT transform AIService results. Typed IAIResult values cross the
 *   bridge exactly as returned — errors included.
 * - It never throws across the IPC boundary. AIService already guarantees
 *   typed IAIResult on all code paths and never throws, so no try/catch is
 *   needed in the handler.
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to remove handlers on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   ai:generate → AIService.generate(request)
 *
 * No push events in V0.1 — the generate flow is invoke/response only.
 * Streaming responses are deferred to a future performance phase.
 *
 * Lifecycle:
 *   aiIpcHandlers.register() — called once after app is ready.
 *   aiIpcHandlers.remove()   — called on app quit or window close.
 */

import { ipcMain } from 'electron'
import { AIService } from '../ai/AIService'
import { AiIpcChannels } from '@shared/types/ipc'
import type { IAIGenerateRequest } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the AI generation subsystem.
 *
 * Must be called exactly once during app startup, after the BrowserWindow
 * has been created. No window reference is needed — the ai:generate channel
 * is invoke/response only (no push events in V0.1).
 */
function registerAiIpcHandlers(): void {
  // -------------------------------------------------------------------------
  // Invoke: ai:generate
  //
  // Generates firmware from a natural-language prompt.
  //
  // The handler is a pure delegation to AIService.generate(). No validation,
  // no mapping, no parsing — those are the pipeline's responsibility.
  //
  // AIService guarantees:
  // - Never throws. All errors return as IAIResult { status: 'error' }.
  // - The IAIRawResponse internal type never crosses this boundary.
  // - IAIProviderConfig (API keys) never crosses this boundary.
  //
  // Response: IAIResult
  //   { status: 'success', project: IProjectDocument }
  //   { status: 'error',   code: AIErrorCode, error: string }
  // -------------------------------------------------------------------------
  ipcMain.handle(AiIpcChannels.generate, (_event, request: IAIGenerateRequest) => {
    return AIService.generate(request)
  })
}

/**
 * Removes all ipcMain handlers registered by this module.
 *
 * Must be called when the application is quitting to prevent stale handlers
 * from accumulating across hot-reloads in development.
 *
 * No additional cleanup is needed — the AI subsystem has no persistent
 * sessions, open file handles, or OS-level resources to release.
 */
function removeAiIpcHandlers(): void {
  ipcMain.removeHandler(AiIpcChannels.generate)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const aiIpcHandlers = Object.freeze({
  register: registerAiIpcHandlers,
  remove: removeAiIpcHandlers
})
