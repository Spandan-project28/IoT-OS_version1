/**
 * project-persistence.ts
 *
 * Shared type definitions for the Project Persistence domain (Phase 7).
 *
 * This is the single source of truth for the project:* IPC contract —
 * request/result shapes for opening, saving, renaming, deleting, and
 * autosaving projects, plus the recent-projects registry entry shape.
 *
 * Architectural rules:
 * - IProjectFileDTO (the on-disk persistence shape) is intentionally NOT
 *   defined here. It is a Main-process-only internal type declared inside
 *   src/main/services/ProjectService.ts and must never be added to
 *   src/shared/types — the Renderer must never see it (Slice 28 ADR).
 * - Every result type follows the existing never-reject IPC convention
 *   established by ICompileResult / IUploadResult / IAIResult: a
 *   discriminated union on `status`, never a thrown/rejected error.
 * - IProjectSaveRequest.filePath is `string`, never `string | null`
 *   (ADR-P7-015) — the Renderer redirects to Save As before invoking
 *   project:save when there is no existing path.
 *
 * Slice 28 note:
 * - Only IWorkspaceInfo-adjacent wiring (workspace:info) is live in this
 *   slice. Every type below is defined now so the IPC contract in ipc.ts
 *   is complete upfront; no project:* channel is registered until its
 *   owning slice (30, 31, 32, or 33).
 *
 * Consumers:
 * - ProjectService       (Main process — produces IProjectOpenResult / IProjectSaveResult, etc.)
 * - RecentProjectsService (Main process — produces IRecentProject[])
 * - projectIpcHandlers   (Main process — serialises these types across the IPC boundary)
 * - Preload bridge       (types the window.api.project surface)
 * - Zustand store        (future slices — stores these results in Renderer state)
 */

import type { IProjectDocument, ProjectOrigin } from './project'

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Structured error codes for every project persistence operation.
 *
 * Allows callers (IPC, Zustand, UI) to branch on error category without
 * parsing the user-facing message string — matches the UploadErrorCode
 * convention in upload.ts.
 */
export type ProjectErrorCode =
  | 'file_not_found' //          the target file does not exist on disk
  | 'permission_denied' //       the OS denied read/write access
  | 'corrupted_project' //       file exists but is not valid JSON / does not match IProjectFileDTO
  | 'schema_migration_failed' // a migration from an older fileVersion failed
  | 'disk_full' //                write failed because the disk is full
  | 'workspace_missing' //       the workspace root does not exist and could not be created
  | 'unknown' //                  catch-all, including "not yet implemented" in Slice 28

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

/** Request payload for the project:open invoke channel. */
export interface IProjectOpenRequest {
  /** Absolute path to the project.iotos file to open. */
  readonly filePath: string
}

/**
 * Result of ProjectService.open().
 *
 * On success, carries the fully reconstructed IProjectDocument, the path it
 * was loaded from, and the persisted savedAt timestamp (used to restore
 * lastSavedAt in the Zustand store in a later slice).
 */
export type IProjectOpenResult =
  | { status: 'success'; document: IProjectDocument; filePath: string; savedAt: string }
  | { status: 'error'; code: ProjectErrorCode; error: string }

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/** Request payload for the project:save invoke channel. */
export interface IProjectSaveRequest {
  readonly document: IProjectDocument
  /** Absolute destination path. Always a concrete string — never null (ADR-P7-015). */
  readonly filePath: string
}

/** Result of ProjectService.save(). */
export type IProjectSaveResult =
  | { status: 'success'; filePath: string; savedAt: string }
  | { status: 'error'; code: ProjectErrorCode; error: string }

// ---------------------------------------------------------------------------
// Save As
// ---------------------------------------------------------------------------

/** Request payload for the project:saveAs invoke channel. */
export interface IProjectSaveAsRequest {
  readonly document: IProjectDocument
  /** Suggested title, used to derive the default save-dialog directory/filename. */
  readonly suggestedTitle: string
}

/**
 * Result of the Save As flow.
 *
 * 'cancelled' is a distinct outcome, not an error (Slice 30, Ambiguity B) —
 * the user dismissing the native save dialog is a normal action, not a
 * failure. The handler returns this without ever calling ProjectService.save().
 */
export type IProjectSaveAsResult =
  | { status: 'success'; filePath: string; savedAt: string }
  | { status: 'cancelled' }
  | { status: 'error'; code: ProjectErrorCode; error: string }

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

/** Request payload for the project:rename invoke channel. */
export interface IProjectRenameRequest {
  readonly filePath: string
  readonly newTitle: string
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Request payload for the project:delete invoke channel. */
export interface IProjectDeleteRequest {
  readonly filePath: string
}

/** Result of ProjectService.delete(). */
export type IProjectDeleteResult =
  | { status: 'success' }
  | { status: 'error'; code: ProjectErrorCode; error: string }

// ---------------------------------------------------------------------------
// Autosave
// ---------------------------------------------------------------------------

/** Request payload for the project:autosave invoke channel. */
export interface IProjectAutosaveRequest {
  readonly document: IProjectDocument
}

// ---------------------------------------------------------------------------
// Saved push event
// ---------------------------------------------------------------------------

/** Payload pushed on the project:saved one-way channel after a successful autosave. */
export interface IProjectSavedPayload {
  readonly filePath: string
  readonly savedAt: string
  readonly saveType: 'manual' | 'autosave'
}

// ---------------------------------------------------------------------------
// Recent projects
// ---------------------------------------------------------------------------

/**
 * A single entry in the recent-projects registry.
 *
 * Produced by RecentProjectsService, returned in full by the project:recent
 * invoke channel.
 */
export interface IRecentProject {
  readonly filePath: string
  readonly title: string
  readonly origin: ProjectOrigin
  readonly savedAt: string
}
