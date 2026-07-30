/**
 * project.ts
 *
 * Shared type definitions for the Project domain.
 *
 * IProjectDocument is the canonical runtime model for every project in IoTOS AI.
 * All project data — whether sourced from a template or AI generation — is
 * normalised into this shape before it reaches the Renderer or Zustand store.
 *
 * Architectural rules (ADR-010, ADR-013, ADR-016):
 * - IProjectDocument instances are immutable runtime objects.
 * - No operation mutates an existing instance in-place.
 * - selectTemplate() constructs a fresh IProjectDocument and replaces
 *   currentProjectDoc atomically via Zustand set().
 * - generateAiProject() stores the AI-generated IProjectDocument and replaces
 *   currentProjectDoc atomically.
 * - Future regeneration actions request a new IProjectDocument and replace
 *   currentProjectDoc — they never patch fields on the existing instance.
 * - clearProject() sets currentProjectDoc = null; it does not reset individual fields.
 *
 * Schema evolution strategy:
 * - schemaVersion is a literal type, not a plain number.
 * - Future schema versions define a new literal (e.g. schemaVersion: 2 as const).
 * - All migrations occur through explicit migration functions in a dedicated
 *   migration module — never through conditional logic scattered across the application.
 *
 * Consumers (V0.1):
 * - AIService          (Main process — constructs IProjectDocument from IAIRawResponse)
 * - Zustand store      (Slice 25 — stores currentProjectDoc, replaces atomically)
 * - Editor page        (Slice 26 — reads currentProjectDoc for firmware and assistant panel)
 *
 * Future consumers (out of scope for V0.1):
 * - ProjectService     (Phase 7 — persists IProjectDocument to disk)
 * - UndoRedoManager    (future — maintains previousProjects: IProjectDocument[] stack)
 * - CloudSyncService   (future — serialises IProjectDocument snapshots)
 */

import type { ITemplateComponent } from './template'
import type { SupportedBoard } from './template'

// ---------------------------------------------------------------------------
// Schema version
//
// Literal type enforced at every IProjectDocument construction site.
// TypeScript's type checker verifies this at compile time — no runtime check
// is needed because the schema version cannot be wrong by construction.
//
// When a new schema version is introduced:
// 1. Add the new literal to the ProjectSchemaVersion union.
// 2. Write a migration function: migrateV1ToV2(doc: IProjectDocumentV1): IProjectDocumentV2
// 3. Call the migration function when loading persisted projects from disk.
// 4. Never add conditional branches on schemaVersion outside the migration module.
// ---------------------------------------------------------------------------

/**
 * The set of all schema versions ever defined for IProjectDocument.
 *
 * A union type allows migration functions to use exhaustive type narrowing
 * without needing to cast or use `any`.
 *
 * V0.1 defines only version 1. Future versions add new members to this union.
 */
export type ProjectSchemaVersion = 1

// ---------------------------------------------------------------------------
// Project metadata
//
// Carries provenance information recorded at the moment of project creation.
// Because IProjectDocument is immutable, provenance cannot be added later —
// it must be captured at construction time.
// ---------------------------------------------------------------------------

/**
 * The source that produced a project document.
 *
 * - 'template' — project was created by selecting a built-in template
 * - 'ai'       — project was created by AI firmware generation
 */
export type ProjectOrigin = 'template' | 'ai'

/**
 * Provenance and creation metadata for a project document.
 *
 * Recorded once at construction and never modified (ADR-016).
 *
 * Rationale for optional fields:
 * - generator, provider, and model are only meaningful for AI-generated projects.
 *   Template-sourced projects do not have a prompt version or LLM provider.
 *   Using optional fields (rather than a discriminated union) keeps the metadata
 *   shape simple and consistent for all consumers.
 */
export interface IProjectMetadata {
  /**
   * The source that produced this project document.
   *
   * Used by the UI to render the correct origin badge
   * ('Template' vs 'AI Generated') in the Editor.
   */
  readonly origin: ProjectOrigin

  /**
   * ISO 8601 timestamp recorded at the moment this document was constructed.
   *
   * Recorded by the constructor — not derived from system time on access —
   * so it is stable across serialisation and deserialisation.
   *
   * Example: '2026-07-27T12:00:00.000Z'
   */
  readonly createdAt: string

  /**
   * The prompt system version that generated this project.
   *
   * Set to 'PromptBuilder v{PROMPT_VERSION}' by AIService.
   * Undefined for template-sourced projects.
   *
   * Allows future debugging: if a generated project is incorrect, the
   * prompt version recorded here identifies which prompt produced it.
   *
   * Example: 'PromptBuilder v1'
   */
  readonly generator?: string

  /**
   * The AI provider used to generate this project.
   *
   * Resolved from AI_PROVIDER env var at generation time.
   * Undefined for template-sourced projects.
   *
   * Preserved for debugging, regeneration, and future project history features.
   *
   * Examples: 'openai', 'ollama', 'openrouter', 'mock'
   */
  readonly provider?: string

  /**
   * The specific AI model used to generate this project.
   *
   * Resolved from AI_MODEL env var at generation time.
   * Undefined for template-sourced projects.
   *
   * Preserved for debugging and regeneration — a future 'Regenerate' action
   * can offer to use the same model that produced the original project.
   *
   * Examples: 'gpt-4o', 'llama3.1', 'gemini-1.5-pro'
   */
  readonly model?: string
}

// ---------------------------------------------------------------------------
// Project document
//
// The canonical immutable runtime model for a single project.
// Every field is required. Optional content uses `string | null` rather than
// optional fields so consumers can always read the field without guarding for
// undefined — they only guard for null when the content is genuinely absent.
// ---------------------------------------------------------------------------

/**
 * The canonical immutable runtime model for a single IoTOS AI project.
 *
 * Produced by:
 * - selectTemplate():     constructs from ITemplateDefinition
 * - generateAiProject():  constructs from IAIRawResponse via AIService
 *
 * Consumed by:
 * - Zustand store:  stored as currentProjectDoc; replaced atomically on every update
 * - Editor page:    reads firmware for Monaco, reads assistant fields for info panel
 * - Upload flow:    reads firmware as the source for UploadService
 *
 * Immutability contract (ADR-016):
 * - All fields are marked readonly.
 * - The components array is ReadonlyArray to prevent element mutation.
 * - The metadata object is IProjectMetadata (all fields readonly).
 * - Zustand must never call Object.assign(currentProjectDoc, updates).
 * - Zustand must never assign to currentProjectDoc.someField directly.
 * - Every update replaces currentProjectDoc with a new IProjectDocument instance.
 *
 * Schema versioning contract (ADR-013):
 * - schemaVersion is the literal 1, not a plain number.
 * - TypeScript enforces this at every construction site.
 * - Migration functions handle version transitions — not conditional branches here.
 */
export interface IProjectDocument {
  /**
   * Unique, permanent identity for this project document.
   *
   * Generated once (nanoid) at construction time by selectTemplate() or
   * generateAiProject() — never regenerated afterwards, including on save,
   * rename, autosave, or reload from disk. ProjectService.open() restores
   * this value verbatim from the persisted file; it never mints a new one.
   *
   * Consumers: Monaco editor key prop (project-switch reset), project
   * identity tracking across the persistence layer (Phase 7).
   */
  readonly id: string

  /**
   * Schema version for this document.
   *
   * Literal type 1 — TypeScript enforces this at every construction site.
   * Future schema versions introduce a new IProjectDocument shape rather than
   * adding optional fields to this interface.
   */
  readonly schemaVersion: 1

  /**
   * Human-readable project title displayed in the TopBar and project history.
   *
   * For template-sourced projects: ITemplateDefinition.name
   * For AI-generated projects: derived from the user's prompt (first sentence
   * or a summary generated by AIService)
   */
  readonly title: string

  /**
   * Beginner-friendly description of what this project does.
   *
   * Displayed in the Editor's assistant panel under the project title.
   * For template projects: ITemplateDefinition.description
   * For AI projects: the explanation field from IAIRawResponse
   */
  readonly description: string

  /**
   * Complete, compilable firmware source code for this project.
   *
   * Displayed in the Monaco editor on the left panel.
   * Passed as the source field to UploadService when the user uploads.
   * Never transformed or parsed by the Editor — it is always the raw source.
   */
  readonly firmware: string

  /**
   * Human-readable explanation of how the firmware works.
   *
   * Displayed in the Editor's assistant panel under 'How It Works'.
   * For template projects: derived from the template description.
   * For AI projects: the code explanation from the LLM response.
   * Null if no explanation is available.
   */
  readonly explanation: string | null

  /**
   * Physical components the user must assemble before uploading.
   *
   * Displayed as a component checklist in the Editor's assistant panel.
   * Uses ITemplateComponent from template.ts to keep the shape consistent
   * between template-sourced and AI-generated projects.
   *
   * ReadonlyArray enforces the immutability contract — elements cannot be
   * pushed, popped, or modified after the document is constructed.
   */
  readonly components: ReadonlyArray<ITemplateComponent>

  /**
   * Human-readable wiring instructions for this project.
   *
   * Displayed in the Editor's assistant panel under 'Wiring'.
   * Written in plain language, step by step.
   * Null if no wiring instructions are available (e.g. projects with no external components).
   */
  readonly wiring: string | null

  /**
   * Description of what the user should observe after a successful upload.
   *
   * Displayed in the Editor's assistant panel under 'Expected Output'.
   * Describes hardware behaviour and expected Serial Monitor output.
   */
  readonly expectedOutput: string

  /**
   * The target board hint for this project.
   *
   * Used by the Upload flow to pre-select the correct FQBN when multiple boards
   * are connected. Null when no board preference is specified (any compatible
   * board may be used, or the user selects manually).
   *
   * For template projects: the first entry in ITemplateDefinition.boards, or null.
   * For AI projects: the boardHint from the IAIGenerateRequest.
   */
  readonly boardHint: SupportedBoard | null

  /**
   * Provenance and creation metadata for this project document.
   *
   * Recorded at construction and never modified.
   * Consumers use origin to render the correct badge, and generator/provider/model
   * for debugging and future project history features.
   */
  readonly metadata: IProjectMetadata
}
