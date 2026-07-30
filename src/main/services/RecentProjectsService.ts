/**
 * RecentProjectsService
 *
 * Owns the cross-session registry of recently opened/saved projects.
 *
 * Architectural rules (Phase 7, Slice 28):
 * - This module owns the recents registry file and its read/write ONLY.
 * - It NEVER reads or writes a project file itself (that is ProjectService).
 * - It NEVER resolves the workspace root (that is WorkspaceService).
 * - Per architecture.md section 14/15, recent projects are "Persisted State"
 *   alongside Theme/Preferences — application configuration stored
 *   separately from user projects. The registry therefore lives under
 *   Electron's userData directory, NOT inside the project workspace root.
 * - All methods are synchronous and best-effort: a read or write failure is
 *   logged and never thrown — this is a convenience registry, not the
 *   source of truth for any project's existence.
 *
 * Not wired to any IPC channel in Slice 28 — push/remove/getAll are fully
 * functional but uncalled until Slices 30/31 add their call sites.
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { IRecentProject } from '@shared/types/project-persistence'
import type { ProjectOrigin } from '@shared/types/project'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getRegistryPath(): string {
  return path.join(app.getPath('userData'), 'recent-projects.json')
}

/**
 * Reads and parses the registry file.
 * Returns an empty list if the file does not exist or cannot be parsed —
 * a corrupted or missing registry must never crash the app.
 */
function readRegistry(): IRecentProject[] {
  try {
    const raw = fs.readFileSync(getRegistryPath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as IRecentProject[]) : []
  } catch {
    return []
  }
}

/**
 * Writes the registry file. Failures are logged and swallowed — the caller
 * (push/remove) has already applied its change in memory for this process;
 * a failed write only means the change won't survive a restart.
 */
function writeRegistry(entries: IRecentProject[]): void {
  try {
    fs.writeFileSync(getRegistryPath(), JSON.stringify(entries, null, 2), 'utf-8')
  } catch (err) {
    console.error('[RecentProjectsService] Failed to write registry:', err)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adds or updates an entry for filePath and moves it to the front of the
 * list (most recent first). Any existing entry for the same filePath is
 * replaced rather than duplicated.
 */
function push(filePath: string, title: string, origin: ProjectOrigin, savedAt: string): void {
  const existing = readRegistry().filter((entry) => entry.filePath !== filePath)
  const updated: IRecentProject[] = [{ filePath, title, origin, savedAt }, ...existing]
  writeRegistry(updated)
}

/** Removes the entry for filePath, if present. No-op if not found. */
function remove(filePath: string): void {
  const updated = readRegistry().filter((entry) => entry.filePath !== filePath)
  writeRegistry(updated)
}

/** Returns all recent-project entries, most recently pushed first. */
function getAll(): IRecentProject[] {
  return readRegistry()
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const RecentProjectsService = Object.freeze({
  push,
  remove,
  getAll
})
