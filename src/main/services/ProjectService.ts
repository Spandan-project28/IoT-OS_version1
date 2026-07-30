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
 */

import * as fs from 'fs/promises'
import type { IProjectDocument, IProjectMetadata, ProjectSchemaVersion } from '@shared/types/project'
import type { ITemplateComponent, SupportedBoard } from '@shared/types/template'
import type { IProjectOpenResult, IProjectSaveResult } from '@shared/types/project-persistence'

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
 * Maps a Node.js filesystem error to a ProjectErrorCode.
 */
function errorCodeForFsError(err: unknown): 'file_not_found' | 'permission_denied' | 'unknown' {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ENOENT') return 'file_not_found'
  if (code === 'EACCES' || code === 'EPERM') return 'permission_denied'
  return 'unknown'
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

  return {
    status: 'success',
    document: documentFromDto(parsed),
    filePath,
    savedAt: parsed.savedAt
  }
}

/**
 * Scaffold for Slice 30. The full signature and result contract exist now
 * so nothing calling this method needs to change when Slice 30 lands, but
 * no file is written in Slice 28 — this always resolves a typed 'unknown'
 * error, matching the never-reject convention (never throws).
 *
 * @param _doc      - Document to persist (accepted, ignored until Slice 30).
 * @param _filePath - Destination path (accepted, ignored until Slice 30).
 */
async function save(
  // Parameters match the Slice 30 signature exactly; intentionally unused
  // until the atomic-write implementation lands (Slice 28 scaffold).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _doc: IProjectDocument,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _filePath: string
): Promise<IProjectSaveResult> {
  return {
    status: 'error',
    code: 'unknown',
    error: 'ProjectService.save() is not implemented until Slice 30'
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const ProjectService = Object.freeze({
  open,
  save
})
