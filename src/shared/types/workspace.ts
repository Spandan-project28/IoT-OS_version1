/**
 * workspace.ts
 *
 * Shared type definitions for the Workspace domain (Phase 7, Slice 28).
 *
 * The workspace is the on-disk root directory under which all IoTOS AI
 * projects are stored. This file defines the Renderer-visible contract for
 * querying that root — it never exposes filesystem operations, only the
 * resolved path.
 *
 * Consumers:
 * - WorkspaceService (Main process — produces IWorkspaceInfo)
 * - projectIpcHandlers (Main process — serves IWorkspaceInfo via workspace:info)
 * - Renderer (via window.api.workspace.getInfo())
 */

/**
 * A point-in-time snapshot of the workspace location.
 *
 * Returned by WorkspaceService.getInfo() and the workspace:info IPC channel.
 */
export interface IWorkspaceInfo {
  /**
   * Absolute path to the workspace root directory
   * (e.g. "C:\Users\<user>\Documents\IoTOS AI Projects").
   *
   * Guaranteed to exist on disk once WorkspaceService.initialize() has
   * resolved — the directory is created if absent during initialization.
   */
  readonly root: string
}
