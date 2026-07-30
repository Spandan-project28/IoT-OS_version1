/**
 * Project IPC Handlers
 *
 * Registers all ipcMain handlers for the workspace and project persistence
 * subsystems.
 *
 * Architectural rules:
 * - This module owns the boundary between the Main process and the IPC
 *   layer for the workspace:* and project:* channel groups.
 * - It NEVER touches the filesystem directly — all work is delegated to
 *   WorkspaceService, ProjectService, and RecentProjectsService.
 * - It registers handlers at app startup (called from main/index.ts).
 * - It exposes a teardown function to clean up handlers on app quit.
 *
 * Slice 28 scope:
 *   Only workspace:info is registered here. Each subsequent slice adds its
 *   channel(s) directly to register()/remove() in place — no stub handlers
 *   are pre-registered for channels whose service implementation isn't
 *   ready yet (Slice 28 Blocking Ambiguity #2):
 *     save, saveAs    — Slice 30
 *     open, recent    — Slice 31
 *     autosave, saved — Slice 32
 *     rename, delete  — Slice 33
 *
 * mainWindow is accepted now (even though no push channel is wired yet) so
 * this function's signature does not need to change when project:saved
 * (Slice 32) is added — matches the register(mainWindow) pattern already
 * used by hardwareIpcHandlers.ts and serialIpcHandlers.ts.
 *
 * Invoke channels handled here (Renderer → Main):
 *   workspace:info → WorkspaceService.getInfo()
 *
 * Lifecycle:
 *   projectIpcHandlers.register(mainWindow) — called once after app is ready.
 *   projectIpcHandlers.remove()             — called on app quit or window close.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { WorkspaceService } from '../services/WorkspaceService'
import { WorkspaceIpcChannels } from '@shared/types/ipc'
import type { IWorkspaceInfo } from '@shared/types/workspace'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the workspace and project subsystems.
 *
 * Must be called after WorkspaceService.initialize() has resolved, so the
 * workspace:info handler never races an uncreated workspace directory.
 *
 * @param _mainWindow - The application's primary BrowserWindow. Accepted now
 *   (unused in Slice 28) to keep register()'s signature stable ahead of the
 *   project:saved push channel added in Slice 32, matching the
 *   register(mainWindow) pattern already used by hardwareIpcHandlers.ts and
 *   serialIpcHandlers.ts.
 */
function registerProjectIpcHandlers(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mainWindow: BrowserWindow
): void {
  // -------------------------------------------------------------------------
  // Invoke: workspace:info
  //
  // Returns the resolved, already-created workspace root path. No side
  // effects — WorkspaceService.initialize() has already created the
  // directory by the time this handler can be reached.
  // -------------------------------------------------------------------------
  ipcMain.handle(WorkspaceIpcChannels.getInfo, (): IWorkspaceInfo => {
    return WorkspaceService.getInfo()
  })
}

/**
 * Removes all ipcMain handlers registered by this module.
 *
 * Must be called when the application is quitting or the window is closing
 * to prevent stale handlers from accumulating across hot-reloads in
 * development.
 */
function removeProjectIpcHandlers(): void {
  ipcMain.removeHandler(WorkspaceIpcChannels.getInfo)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const projectIpcHandlers = Object.freeze({
  register: registerProjectIpcHandlers,
  remove: removeProjectIpcHandlers
})
