/**
 * AI IPC Handlers
 *
 * Registers all ipcMain handlers for the AI firmware generation subsystem.
 *
 * Architectural rules:
 * - Completely separate from hardwareIpcHandlers.ts, uploadIpcHandlers.ts,
 *   and serialIpcHandlers.ts — the AI generation domain is independent.
 * - This module owns the boundary between the Main process and the AI IPC layer.
 * - It performs NO business logic, NO validation, NO parsing, NO mapping.
 *   All of those responsibilities belong to AIService and its pipeline.
 * - It does NOT transform AIService results. Typed IAIResult values cross the
 *   bridge exactly as returned — errors included.
 * - It never throws across the IPC boundary. AIService already guarantees
 *   typed IAIResult on all code paths and never throws, so no try/catch is
 *   needed in the handler.
 * - Phase 8, Slice 35: this handler is the sole coordination point between
 *   the AI and Settings domains. It calls SettingsService.getResolvedAiSettings()
 *   (a synchronous, Main-process-only read) and passes the result into
 *   AIService.generate() as an explicit parameter — AIService never calls
 *   SettingsService itself, and SettingsService never calls AIService.
 *   No other business logic is performed here; the fetch-and-pass-through
 *   is orchestration, not a decision.
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to remove handlers on app quit.
 *
 * Invoke channels handled here (Renderer → Main):
 *   ai:generate → AIService.generate(request, persisted)
 *
 * Push channels driven here (Main → Renderer):
 *   ai:log → sent on every AiEventBus 'ai:log' event (Phase 11, Integrated Terminal)
 *
 * Lifecycle:
 *   aiIpcHandlers.register(mainWindow) — called once after app is ready.
 *   aiIpcHandlers.remove()             — called on app quit or window close.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { AIService } from '../ai/AIService'
import { AiEventBus } from '../ai/AiEventBus'
import { SettingsService } from '../services/SettingsService'
import { AiIpcChannels } from '@shared/types/ipc'
import type { IAIGenerateRequest, IAILogPayload } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Cached reference to the main BrowserWindow, used to send push events. */
let _mainWindow: BrowserWindow | null = null

/**
 * The listener registered on AiEventBus('ai:log').
 * Stored so it can be removed precisely during teardown without calling
 * removeAllListeners() (which would discard other internal subscribers).
 */
let _logListener: ((payload: IAILogPayload) => void) | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends the ai:log push event to the Renderer if the window still exists
 * and its webContents have not been destroyed.
 *
 * Guard conditions mirror uploadIpcHandlers.ts and hardwareIpcHandlers.ts.
 */
function pushLogToRenderer(payload: IAILogPayload): void {
  if (_mainWindow && !_mainWindow.webContents.isDestroyed()) {
    _mainWindow.webContents.send(AiIpcChannels.log, payload)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the AI generation subsystem.
 *
 * Must be called exactly once during app startup, after the BrowserWindow
 * has been created. The window reference is required to send ai:log push
 * events as AIService produces them (Phase 11, Integrated Terminal).
 *
 * @param mainWindow - The application's primary BrowserWindow. Required to
 *   send push events (ai:log) to the Renderer.
 */
function registerAiIpcHandlers(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow

  // -------------------------------------------------------------------------
  // Invoke: ai:generate
  //
  // Generates firmware from a natural-language prompt.
  //
  // Fetches the resolved persisted AI settings (Phase 8, Slice 35) and
  // passes them into AIService.generate() alongside the request. This is
  // the only cross-service coordination performed here — no validation, no
  // mapping, no parsing, no precedence decision (env var vs. persisted vs.
  // default is decided entirely inside AIService).
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
    const persisted = SettingsService.getResolvedAiSettings()
    return AIService.generate(request, persisted)
  })

  // -------------------------------------------------------------------------
  // Push: ai:log
  //
  // Subscribe to the internal AiEventBus 'ai:log' event and forward it to
  // the Renderer via webContents.send(). This makes the Integrated Terminal
  // reactive to AI generation output without polling from the UI.
  //
  // One event per pipeline step — never batched until ai:generate resolves.
  // -------------------------------------------------------------------------
  _logListener = (payload: IAILogPayload) => {
    pushLogToRenderer(payload)
  }

  AiEventBus.on('ai:log', _logListener)
}

/**
 * Removes all ipcMain handlers and AiEventBus listeners registered by this
 * module.
 *
 * Must be called when the application is quitting to prevent stale handlers
 * from accumulating across hot-reloads in development.
 */
function removeAiIpcHandlers(): void {
  ipcMain.removeHandler(AiIpcChannels.generate)

  if (_logListener) {
    AiEventBus.off('ai:log', _logListener)
    _logListener = null
  }

  _mainWindow = null
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const aiIpcHandlers = Object.freeze({
  register: registerAiIpcHandlers,
  remove: removeAiIpcHandlers
})
