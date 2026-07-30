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
 * mainWindow is accepted now so this function's signature does not need to
 * change when project:saved (Slice 32) is added — matches the
 * register(mainWindow) pattern already used by hardwareIpcHandlers.ts and
 * serialIpcHandlers.ts. Slice 30 is the first to actually use it, as the
 * parent window for the native save dialog.
 *
 * Invoke channels handled here (Renderer → Main):
 *   workspace:info   → WorkspaceService.getInfo()
 *   project:save     → ProjectService.save() (Slice 30)
 *   project:saveAs   → dialog.showSaveDialog() + ProjectService.save() (Slice 30)
 *   project:open     → ProjectService.open() (Slice 31)
 *   project:recent   → RecentProjectsService.getAll() (Slice 31)
 *   project:autosave → ProjectService.autosave() (Slice 32)
 *
 * Push channels sent here (Main → Renderer):
 *   project:saved → sent after a successful project:autosave, via mainWindow
 *   (Slice 32)
 *
 * Lifecycle:
 *   projectIpcHandlers.register(mainWindow) — called once after app is ready.
 *   projectIpcHandlers.remove()             — called on app quit or window close.
 */

import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { WorkspaceService } from '../services/WorkspaceService'
import { ProjectService } from '../services/ProjectService'
import { RecentProjectsService } from '../services/RecentProjectsService'
import { WorkspaceIpcChannels, ProjectIpcChannels } from '@shared/types/ipc'
import type { IWorkspaceInfo } from '@shared/types/workspace'
import type {
  IProjectOpenRequest,
  IProjectOpenResult,
  IProjectSaveRequest,
  IProjectSaveResult,
  IProjectSaveAsRequest,
  IProjectSaveAsResult,
  IProjectAutosaveRequest,
  IRecentProject
} from '@shared/types/project-persistence'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all ipcMain handlers for the workspace and project subsystems.
 *
 * Must be called after WorkspaceService.initialize() has resolved, so the
 * workspace:info handler never races an uncreated workspace directory.
 *
 * @param mainWindow - The application's primary BrowserWindow. Used as the
 *   parent window for the native Save As dialog.
 */
function registerProjectIpcHandlers(mainWindow: BrowserWindow): void {
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

  // -------------------------------------------------------------------------
  // Invoke: project:save
  //
  // Writes the given document to an already-known path (Ctrl+S on a
  // previously saved project). No dialog, no directory creation — the
  // directory is guaranteed to already exist from the save that produced
  // this path. On success, records the project in the recents registry.
  // -------------------------------------------------------------------------
  ipcMain.handle(
    ProjectIpcChannels.save,
    async (_event, request: IProjectSaveRequest): Promise<IProjectSaveResult> => {
      const result = await ProjectService.save(request.document, request.filePath)

      if (result.status === 'success') {
        RecentProjectsService.push(
          result.filePath,
          request.document.title,
          request.document.metadata.origin,
          result.savedAt
        )
      }

      return result
    }
  )

  // -------------------------------------------------------------------------
  // Invoke: project:saveAs
  //
  // Shows the native Save dialog, defaulting into a fresh workspace
  // subdirectory named from the document's title. Creates that directory
  // before writing (ProjectService never creates directories itself). If
  // the user cancels the dialog, returns { status: 'cancelled' } directly
  // without calling ProjectService.save() — cancellation is not an error
  // (Slice 30, Ambiguity B). On success, records the project in the
  // recents registry.
  // -------------------------------------------------------------------------
  ipcMain.handle(
    ProjectIpcChannels.saveAs,
    async (_event, request: IProjectSaveAsRequest): Promise<IProjectSaveAsResult> => {
      const defaultPath = path.join(
        WorkspaceService.getDefaultProjectDir(request.suggestedTitle),
        'project.iotos'
      )

      const dialogResult = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: [{ name: 'IoTOS Project', extensions: ['iotos'] }]
      })

      if (dialogResult.canceled || !dialogResult.filePath) {
        return { status: 'cancelled' }
      }

      fs.mkdirSync(path.dirname(dialogResult.filePath), { recursive: true })

      const result = await ProjectService.save(request.document, dialogResult.filePath)

      if (result.status === 'success') {
        RecentProjectsService.push(
          result.filePath,
          request.document.title,
          request.document.metadata.origin,
          result.savedAt
        )
      }

      return result
    }
  )

  // -------------------------------------------------------------------------
  // Invoke: project:open
  //
  // Reads, parses, and reconstructs a project file from the given path. If
  // the file no longer exists, the stale entry is removed from the recents
  // registry before returning — a deleted/moved file must not keep showing
  // up in Recent Projects.
  // -------------------------------------------------------------------------
  ipcMain.handle(
    ProjectIpcChannels.open,
    async (_event, request: IProjectOpenRequest): Promise<IProjectOpenResult> => {
      const result = await ProjectService.open(request.filePath)

      if (result.status === 'error' && result.code === 'file_not_found') {
        RecentProjectsService.remove(request.filePath)
      }

      return result
    }
  )

  // -------------------------------------------------------------------------
  // Invoke: project:recent
  //
  // Returns the full recent-projects registry, most recently pushed first.
  // Pure passthrough — no filtering or side effects.
  // -------------------------------------------------------------------------
  ipcMain.handle(ProjectIpcChannels.recent, (): IRecentProject[] => {
    return RecentProjectsService.getAll()
  })

  // -------------------------------------------------------------------------
  // Invoke: project:autosave
  //
  // Autosaves to the last known destination — ProjectService.autosave()
  // resolves the path itself (IProjectAutosaveRequest carries none). On
  // success, pushes project:saved so any window can reconcile its own state,
  // and records the project in the recents registry, matching save/saveAs.
  // -------------------------------------------------------------------------
  ipcMain.handle(
    ProjectIpcChannels.autosave,
    async (_event, request: IProjectAutosaveRequest): Promise<IProjectSaveResult> => {
      const result = await ProjectService.autosave(request.document)

      if (result.status === 'success') {
        mainWindow.webContents.send(ProjectIpcChannels.saved, {
          filePath: result.filePath,
          savedAt: result.savedAt,
          saveType: 'autosave'
        })

        RecentProjectsService.push(
          result.filePath,
          request.document.title,
          request.document.metadata.origin,
          result.savedAt
        )
      }

      return result
    }
  )
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
  ipcMain.removeHandler(ProjectIpcChannels.save)
  ipcMain.removeHandler(ProjectIpcChannels.saveAs)
  ipcMain.removeHandler(ProjectIpcChannels.open)
  ipcMain.removeHandler(ProjectIpcChannels.recent)
  ipcMain.removeHandler(ProjectIpcChannels.autosave)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const projectIpcHandlers = Object.freeze({
  register: registerProjectIpcHandlers,
  remove: removeProjectIpcHandlers
})
