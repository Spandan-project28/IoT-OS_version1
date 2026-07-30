/**
 * ProjectService
 *
 * Owns the shape and (de)serialization of a single project file on disk.
 *
 * Architectural rules (Phase 7, Slice 28):
 * - IProjectFileDTO is defined here, unexported, and MUST NEVER be added to
 *   src/shared/types — the Renderer must never see the persistence-layer
 *   shape (Slice 28 ADR, Blocking Ambiguity #1).
 * - This module owns reading/writing ONE project file. It never touches the
 *   workspace root (WorkspaceService) or the recents registry
 *   (RecentProjectsService).
 * - It never shows a dialog and never creates a project directory — those
 *   belong to the IPC handler (per the Slice 30 handler contract).
 * - Every public method returns a typed result and never throws or rejects,
 *   matching the ICompileResult / IUploadResult / IAIResult convention used
 *   throughout the codebase.
 *
 * Slice 28 scope:
 * - open() is fully implemented: real read, real parse, real validation,
 *   real reconstruction of IProjectDocument.
 * - save() is a scaffold: the signature and IProjectFileDTO shape exist,
 *   but no file is written. It resolves a typed 'unknown' error result.
 *   The DTO-construction (document -> DTO) direction and the atomic-write
 *   mechanism are deferred to Slice 30.
 *
 * Slice 30 scope:
 * - save() is fully implemented: document -> DTO construction and an atomic
 *   write (write a <filePath>.tmp file, flush, close, then rename over the
 *   destination).
 * - Every successful save() call updates module-level _pendingDoc and
 *   _pendingPath, consumed by flush() in Slice 32.
 *
 * Slice 32 scope:
 * - open() additionally updates _pending on success, completing the
 *   persistence lifecycle so autosave/flush work for a project opened from
 *   disk without requiring an intervening manual save.
 * - autosave() and flush() are new, both built entirely on the existing
 *   save() — no duplicated persistence logic.
 */

import * as fs from 'fs/promises'
import type { IProjectDocument, IProjectMetadata, ProjectSchemaVersion } from '@shared/types/project'
import type { ITemplateComponent, SupportedBoard } from '@shared/types/template'
import type { IProjectOpenResult, IProjectSaveResult } from '@shared/types/project-persistence'

// ---------------------------------------------------------------------------
// Internal state
//
// The most recently saved document and the path it was saved to. Updated on
// every successful save() call, and on every successful open() call (Slice
// 32) — consumed by autosave() (resolves the destination path, since
// IProjectAutosaveRequest carries no filePath) and flush() (the quit-time
// persistence operation).
//
// Held as a single object (rather than two module-level `let` bindings) so
// save() can update both fields via property assignment — TypeScript's
// noUnusedLocals does not flag a module-scope variable that is written to
// via member access, only one reassigned directly with no reads anywhere.
// ---------------------------------------------------------------------------

const _pending: { doc: IProjectDocument | null; path: string | null } = {
  doc: null,
  path: null
}

// ---------------------------------------------------------------------------
// Persistence-layer shape (Main-process-only — never exported via @shared)
// ---------------------------------------------------------------------------

/**
 * The on-disk shape of a project.iotos file.
 *
 * Distinct from IProjectDocument:
 * - fileVersion tracks the persistence format and drives schema migration
 *   (ProjectMigrations.ts, Slice 31) — independent of IProjectDocument's
 *   own schemaVersion, which tracks the in-memory document shape.
 * - savedAt is persistence metadata with no equivalent on IProjectDocument.
 *
 * This interface is intentionally NOT exported. The Renderer must never
 * construct or receive a value of this shape.
 */
interface IProjectFileDTO {
  readonly fileVersion: 1
  readonly id: string
  readonly schemaVersion: ProjectSchemaVersion
  readonly title: string
  readonly description: string
  readonly firmware: string
  readonly explanation: string | null
  readonly components: ReadonlyArray<ITemplateComponent>
  readonly wiring: string | null
  readonly expectedOutput: string
  readonly boardHint: SupportedBoard | null
  readonly metadata: IProjectMetadata
  readonly savedAt: string
}

// ---------------------------------------------------------------------------
// Private: validation and mapping
// ---------------------------------------------------------------------------

/**
 * Minimal structural validation of a parsed JSON value against the
 * IProjectFileDTO shape. Checks required top-level fields and primitive
 * types only — not a full schema validator (Predictability over
 * Cleverness; no schema-validation library is a project dependency).
 *
 * fileVersion is checked only for type (number), not value — a non-1
 * fileVersion is a structurally valid DTO with an unsupported version, and
 * must be reported as schema_migration_failed (checked separately in
 * open()), not corrupted_project. Gating on fileVersion === 1 here would
 * make that distinction unreachable.
 */
function isValidProjectFileDto(value: unknown): value is IProjectFileDTO {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return (
    typeof v.fileVersion === 'number' &&
    typeof v.id === 'string' &&
    v.schemaVersion === 1 &&
    typeof v.title === 'string' &&
    typeof v.description === 'string' &&
    typeof v.firmware === 'string' &&
    (typeof v.explanation === 'string' || v.explanation === null) &&
    Array.isArray(v.components) &&
    (typeof v.wiring === 'string' || v.wiring === null) &&
    typeof v.expectedOutput === 'string' &&
    (typeof v.boardHint === 'string' || v.boardHint === null) &&
    typeof v.metadata === 'object' &&
    v.metadata !== null &&
    typeof v.savedAt === 'string'
  )
}

/**
 * Reconstructs an immutable IProjectDocument from a validated DTO.
 *
 * This is the DTO -> IProjectDocument direction only, used by open().
 * The reverse direction (IProjectDocument -> IProjectFileDTO, used by
 * save()) is deferred to Slice 30.
 */
function documentFromDto(dto: IProjectFileDTO): IProjectDocument {
  return {
    id: dto.id,
    schemaVersion: dto.schemaVersion,
    title: dto.title,
    description: dto.description,
    firmware: dto.firmware,
    explanation: dto.explanation,
    components: dto.components,
    wiring: dto.wiring,
    expectedOutput: dto.expectedOutput,
    boardHint: dto.boardHint,
    metadata: dto.metadata
  }
}

/**
 * Maps an IProjectDocument to its on-disk DTO shape at the moment of saving.
 *
 * This is the IProjectDocument -> DTO direction only, used by save().
 * The reverse direction (documentFromDto, used by open()) is unchanged.
 */
function documentToDto(doc: IProjectDocument, savedAt: string): IProjectFileDTO {
  return {
    fileVersion: 1,
    id: doc.id,
    schemaVersion: doc.schemaVersion,
    title: doc.title,
    description: doc.description,
    firmware: doc.firmware,
    explanation: doc.explanation,
    components: doc.components,
    wiring: doc.wiring,
    expectedOutput: doc.expectedOutput,
    boardHint: doc.boardHint,
    metadata: doc.metadata,
    savedAt
  }
}

/**
 * Maps a Node.js filesystem error to a ProjectErrorCode.
 */
function errorCodeForFsError(
  err: unknown
): 'file_not_found' | 'permission_denied' | 'disk_full' | 'unknown' {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ENOENT') return 'file_not_found'
  if (code === 'EACCES' || code === 'EPERM') return 'permission_denied'
  if (code === 'ENOSPC') return 'disk_full'
  return 'unknown'
}

/**
 * Writes data to filePath atomically: write to a temporary file in the same
 * directory, flush it to disk, close the handle, then rename it over the
 * destination. Writing the temp file in the same directory guarantees the
 * final rename is on the same volume (required for an atomic rename on both
 * POSIX and Windows).
 *
 * Throws on failure — callers are responsible for catching and mapping the
 * error via errorCodeForFsError(), matching the pattern already used for
 * reads in open().
 */
async function writeFileAtomic(filePath: string, data: string): Promise<void> {
  const tempPath = `${filePath}.tmp`
  const handle = await fs.open(tempPath, 'w')
  try {
    await handle.writeFile(data, 'utf-8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tempPath, filePath)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads, parses, validates, and reconstructs a project file from disk.
 *
 * fileVersion !== 1 is treated as an unsupported/unmigrated format
 * (schema_migration_failed) — ProjectMigrations.ts does not exist until
 * Slice 31, so no migration is attempted here; this produces the same
 * outcome Slice 31's scaffold describes for fileVersion 1 (passthrough)
 * and fails closed for any other version.
 *
 * Never throws — every failure is returned as a typed error result.
 */
async function open(filePath: string): Promise<IProjectOpenResult> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    return { status: 'error', code: errorCodeForFsError(err), error: `Failed to read ${filePath}` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'error', code: 'corrupted_project', error: `${filePath} is not valid JSON` }
  }

  if (!isValidProjectFileDto(parsed)) {
    return {
      status: 'error',
      code: 'corrupted_project',
      error: `${filePath} does not match the expected project file shape`
    }
  }

  if (parsed.fileVersion !== 1) {
    return {
      status: 'error',
      code: 'schema_migration_failed',
      error: `${filePath} has an unsupported file version`
    }
  }

  const document = documentFromDto(parsed)

  // Completes the persistence lifecycle (Slice 32): a project opened but
  // never manually saved this session still has a known autosave/flush
  // destination, exactly as if it had just been saved.
  _pending.doc = document
  _pending.path = filePath

  return {
    status: 'success',
    document,
    filePath,
    savedAt: parsed.savedAt
  }
}

/**
 * Constructs the on-disk DTO from doc, writes it to filePath atomically
 * (write <filePath>.tmp, flush, close, rename), and on success records doc
 * and filePath as the pending state consumed by flush() in Slice 32.
 *
 * Never throws — every failure is returned as a typed error result, matching
 * open()'s existing convention.
 */
async function save(doc: IProjectDocument, filePath: string): Promise<IProjectSaveResult> {
  const savedAt = new Date().toISOString()
  const dto = documentToDto(doc, savedAt)

  try {
    await writeFileAtomic(filePath, JSON.stringify(dto, null, 2))
  } catch (err) {
    return { status: 'error', code: errorCodeForFsError(err), error: `Failed to write ${filePath}` }
  }

  _pending.doc = doc
  _pending.path = filePath

  return { status: 'success', filePath, savedAt }
}

/**
 * Autosaves doc to the last known destination (_pending.path), since
 * IProjectAutosaveRequest carries no filePath of its own. Delegates entirely
 * to save() — no duplicated write logic.
 *
 * Returns a typed error if no destination is known yet (no save or open has
 * succeeded this session). 'unknown' is this type's documented catch-all —
 * no other ProjectErrorCode describes "no destination is known at all".
 *
 * Never throws — matches every other public method's convention.
 */
async function autosave(doc: IProjectDocument): Promise<IProjectSaveResult> {
  if (_pending.path === null) {
    return { status: 'error', code: 'unknown', error: 'No known save location for autosave.' }
  }

  return save(doc, _pending.path)
}

/**
 * Re-persists the last known document to its last known path, if any.
 * Delegates entirely to save() — no duplicated write logic.
 *
 * Returns null (not an error) when nothing is pending — a normal state, e.g.
 * app quit before any save or open occurred this session.
 *
 * Never throws — callers (main/index.ts's before-quit handler) treat a
 * rejected promise as a genuine failure to log, not an expected outcome.
 */
async function flush(): Promise<IProjectSaveResult | null> {
  if (_pending.doc === null || _pending.path === null) return null

  return save(_pending.doc, _pending.path)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const ProjectService = Object.freeze({
  open,
  save,
  autosave,
  flush
})
