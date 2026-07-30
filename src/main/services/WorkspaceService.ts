/**
 * WorkspaceService
 *
 * Owns the on-disk workspace root under which all IoTOS AI projects are
 * stored, and the naming convention used to derive a default project
 * directory from a project title.
 *
 * Architectural rules (Phase 7, Slice 28):
 * - This module owns path resolution and directory creation ONLY.
 * - It NEVER reads or writes a project file (that is ProjectService).
 * - It NEVER touches the recent-projects registry (that is RecentProjectsService).
 * - It holds no OS handles and therefore requires no teardown counterpart —
 *   unlike HardwareManager/SerialService, there is nothing to stop on quit.
 *
 * Lifecycle:
 *   WorkspaceService.initialize() — called once at app startup, before
 *   projectIpcHandlers.register(). Resolves and creates the workspace root.
 *   getWorkspaceRoot() / getDefaultProjectDir() / getInfo() are only valid
 *   to call after initialize() has resolved.
 */

import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { nanoid } from 'nanoid'
import type { IWorkspaceInfo } from '@shared/types/workspace'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** The resolved, created workspace root. Null until initialize() resolves. */
let _workspaceRoot: string | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maximum length of the slug portion of a default project directory name. */
const MAX_SLUG_LENGTH = 40

/** Length of the random uniqueness suffix appended to every default directory name. */
const SUFFIX_LENGTH = 6

/**
 * Converts a project title into a filesystem-safe slug.
 *
 * Rules (Slice 28 refinement):
 * 1. Lowercase the entire title.
 * 2. Replace whitespace runs with a single hyphen.
 * 3. Strip every character that is not a-z, 0-9, or '-' (covers invalid
 *    filesystem characters and Unicode in one pass — no transliteration).
 * 4. Collapse consecutive hyphens.
 * 5. Trim leading/trailing hyphens.
 * 6. Hard-truncate to MAX_SLUG_LENGTH characters, trimming a trailing hyphen
 *    left by the cut.
 * 7. Fall back to 'untitled-project' if the result is empty.
 */
function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')

  return slug.length > 0 ? slug : 'untitled-project'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves the workspace root (Documents/IoTOS AI Projects) and creates it
 * on disk if absent. Idempotent — safe to call more than once.
 *
 * Must be awaited before projectIpcHandlers.register() is called, so the
 * workspace:info handler never races an uncreated directory.
 */
async function initialize(): Promise<void> {
  const root = path.join(app.getPath('documents'), 'IoTOS AI Projects')
  await fs.mkdir(root, { recursive: true })
  _workspaceRoot = root
}

/**
 * Returns the resolved workspace root path.
 *
 * Throws if called before initialize() has resolved — this is a developer
 * error (incorrect startup ordering), not a user-facing failure mode.
 */
function getWorkspaceRoot(): string {
  if (_workspaceRoot === null) {
    throw new Error('WorkspaceService.getWorkspaceRoot() called before initialize() resolved')
  }
  return _workspaceRoot
}

/**
 * Derives a default project directory path from a project title.
 *
 * Format: <workspaceRoot>/<slug>-<nanoid(6)>
 * No collision detection is performed — the random suffix is treated as a
 * sufficient uniqueness guarantee (Slice 28 refinement).
 */
function getDefaultProjectDir(title: string): string {
  const slug = slugifyTitle(title)
  const suffix = nanoid(SUFFIX_LENGTH)
  return path.join(getWorkspaceRoot(), `${slug}-${suffix}`)
}

/**
 * Returns a point-in-time snapshot of the workspace location for the
 * workspace:info IPC channel.
 */
function getInfo(): IWorkspaceInfo {
  return { root: getWorkspaceRoot() }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const WorkspaceService = Object.freeze({
  initialize,
  getWorkspaceRoot,
  getDefaultProjectDir,
  getInfo
})
