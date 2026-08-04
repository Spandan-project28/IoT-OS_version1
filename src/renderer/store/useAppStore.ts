/**
 * useAppStore
 *
 * The single centralized Zustand store for IoTOS AI.
 *
 * Architectural rules:
 * - This is the ONLY global store. Do NOT create a second hardware store.
 * - All window.api.hardware.* calls are made exclusively from this store.
 *   React components MUST NOT call window.api directly.
 * - All window.api.upload.* calls are made exclusively from this store.
 *   React components MUST NOT call window.api.upload.* directly.
 * - All window.api.serial.* calls are made exclusively from this store.
 *   React components MUST NOT call window.api.serial.* directly.
 * - All window.api.ai.* calls are made exclusively from this store.
 *   React components MUST NOT call window.api.ai.* directly.
 * - All window.api.template.* calls are NOT required — templates are pure
 *   static renderer-side data with no IPC involvement.
 * - Components consume Zustand state through selectors only.
 * - The hardware slice communicates with the preload bridge through typed actions.
 * - The upload slice communicates with the preload bridge through typed actions.
 * - The serial slice communicates with the preload bridge through typed actions.
 * - The AI slice communicates with the preload bridge through typed actions.
 * - The template slice is synchronous and renderer-only — no IPC, no preload.
 * - The push-event unsubscribe handle is a module-level private variable —
 *   it is not application state and must never enter the Zustand state graph.
 *
 * Hardware state lifecycle:
 *   initializeHardware()  → subscribe to push events + load initial state
 *   loadHardwareState()   → one-time read of current snapshot (no I/O trigger)
 *   refreshHardware()     → force out-of-cycle scan + update store
 *   disposeHardware()     → unsubscribe push events + reset initialization flag
 *
 * Upload state lifecycle:
 *   compileFirmware(request)            → compile only, stores ICompileResult
 *   uploadFirmware(firmware)            → upload compiled artifact, stores IUploadResult
 *   compileAndUploadFirmware(request)   → compile + upload in one call, stores IUploadResult
 *
 * Serial state lifecycle:
 *   initializeSerial()      → subscribe to serial:data + serial:statusChanged push events
 *   disposeSerial()         → unsubscribe both push event handles
 *   openSerial(request)     → open a port session, updates serialState per port
 *   closeSerial(request)    → close a port session, updates serialState per port
 *   writeSerial(request)    → write text to an active session
 *   clearSerialLogs(port)   → clear the log buffer for a specific port only
 *   toggleSerialAutoScroll()→ toggle the global auto-scroll preference
 *
 * Template state lifecycle:
 *   selectTemplate(t)  → maps ITemplateDefinition → IProjectDocument, stores in currentProjectDoc
 *   clearProject()     → resets currentProjectDoc and aiError to null
 *
 * AI state lifecycle:
 *   generateAiProject(request) → calls window.api.ai.generate(), stores a pendingAiCandidate
 *                                 (mode 'new') on success or sets aiError on failure. Never throws.
 *   improveAiProject(prompt)   → builds a request from currentProjectDoc, stores a
 *                                 pendingAiCandidate (mode 'improve') on success (Phase 8, Slice 37).
 *   acceptAiCandidate()        → applies the pending candidate to currentProjectDoc; 'improve'
 *                                 mode preserves the original id/path, 'new' mode does not.
 *   discardAiCandidate()       → discards the pending candidate without applying it.
 *
 * Typical usage pattern:
 *   Call initializeHardware() once at the top-level component (AppProviders).
 *   Call disposeHardware() in the corresponding cleanup.
 *   Call initializeSerial() once at the top-level component (AppProviders).
 *   Call disposeSerial() in the corresponding cleanup.
 *   Components read hardware state via useAppStore selectors.
 *   Components trigger uploads via useAppStore upload actions.
 *   Components interact with serial via useAppStore serial actions.
 *   Components read currentProjectDoc and call generateAiProject / selectTemplate / clearProject.
 */

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { IHardwareState } from '@shared/types/hardware'
import type {
  IUploadRequest,
  ICompiledFirmware,
  ICompileResult,
  IUploadResult
} from '@shared/types/upload'
import type {
  ISerialOpenRequest,
  ISerialCloseRequest,
  ISerialWriteRequest,
  ISerialSessionState,
  ISerialDataPayload,
  ISerialStatusPayload
} from '@shared/types/serial'
import type { ITemplateDefinition } from '@shared/types/template'
import type { IProjectDocument, IProjectMetadata } from '@shared/types/project'
import type { IAIGenerateRequest, AIErrorCode } from '@shared/types/ai'
import type { IRecentProject, IProjectSavedPayload, IProjectDeleteResult } from '@shared/types/project-persistence'
import type { IAiSettingsConfig, IAiSettingsSaveRequest, ISettingsSaveResult } from '@shared/types/settings'

// ---------------------------------------------------------------------------
// Safe default hardware state
//
// Represents the hardware layer in a known-empty state before the first IPC
// response arrives. Matches the safe fallback returned by HardwareManager.getState()
// when the lifecycle has not yet started.
// ---------------------------------------------------------------------------

const DEFAULT_HARDWARE_STATE: IHardwareState = {
  cli: {
    isInstalled: false,
    version: null,
    installedCores: []
  },
  ports: [],
  connectedBoards: [],
  selectedBoardId: null,
  isScanning: false,
  lastScanTimestamp: 0
}

// ---------------------------------------------------------------------------
// AppState interface
// ---------------------------------------------------------------------------

export interface AppState {
  // -------------------------------------------------------------------------
  // Pure UI State
  // -------------------------------------------------------------------------

  sidebarCollapsed: boolean
  currentTheme: 'dark' | 'light'

  // -------------------------------------------------------------------------
  // AI / Project State (Phase 6, Slice 25)
  //
  // IProjectDocument is the single runtime model for all project content —
  // whether sourced from a template or AI generation.
  //
  // Both selectTemplate() and generateAiProject() write to this field.
  // The Editor page reads exclusively from this field.
  //
  // Immutability contract (ADR-016):
  // - Every write atomically replaces the entire IProjectDocument instance.
  // - No action ever mutates fields on the existing instance in-place.
  // - clearProject() sets this to null — it does not reset individual fields.
  // -------------------------------------------------------------------------

  /**
   * The currently active project document.
   *
   * The single source of truth for all project content in the Editor:
   * - firmware source displayed in Monaco
   * - explanation, components, wiring, expectedOutput in the assistant panel
   * - title in the TopBar
   * - metadata for origin badge and debug information
   *
   * Null on application startup and after clearProject() is called.
   * Replaced atomically by selectTemplate() and generateAiProject().
   */
  currentProjectDoc: IProjectDocument | null

  /**
   * True while generateAiProject() is awaiting the IPC response from AIService.
   *
   * Reset to false in the finally block — guaranteed even if the preload call
   * rejects or AIService returns an error result.
   *
   * Components use this to show a loading indicator and disable the Generate button.
   */
  aiLoading: boolean

  /**
   * Human-readable error message from the last failed generateAiProject() call.
   *
   * Null on startup, cleared at the start of each new generateAiProject() call,
   * and set when AIService returns IAIResult { status: 'error' }.
   * Also cleared by clearProject().
   */
  aiError: string | null

  /**
   * Structured error code from the last failed generateAiProject() call
   * (Phase 8, Slice 35).
   *
   * Null on startup, cleared at the start of each new generateAiProject()
   * call (including the API-unavailable guard branch), and set alongside
   * aiError whenever AIService returns a typed IAIResult { status: 'error' }.
   * Left null after an IPC transport failure, since transport failures have
   * no AIErrorCode.
   *
   * Allows the UI to branch on error category (e.g. offering a link to
   * Settings for 'not_configured' / 'invalid_api_key') without parsing
   * aiError's message string.
   */
  aiErrorCode: AIErrorCode | null

  /**
   * The most recent successful AI generation result, awaiting explicit user
   * confirmation before it can replace currentProjectDoc (Phase 8, Slice 36).
   *
   * Null until generateAiProject() succeeds. Populated instead of writing
   * directly to currentProjectDoc — closes the data-loss bug where a
   * successful generation would silently overwrite an active, dirty,
   * unsaved project. Cleared by acceptAiCandidate(), discardAiCandidate(),
   * or whenever the active project identity changes (clearProject(),
   * selectTemplate(), openProject()) — a candidate generated against one
   * project must never be accepted onto a different, subsequently active
   * one.
   */
  pendingAiCandidate: IProjectDocument | null

  /**
   * The kind of pending candidate, or null when none is pending.
   *
   * 'new' is produced by generateAiProject() — a fresh generation with no
   * relationship to any prior project.
   * 'improve' is produced by improveAiProject() (Phase 8, Slice 37) — a
   * revision of the active project's existing firmware. acceptAiCandidate()
   * branches on this value to decide whether accepting the candidate starts
   * a new project identity ('new') or updates the existing one in place
   * ('improve').
   *
   * Non-null if and only if pendingAiCandidate is non-null.
   */
  pendingAiCandidateMode: 'new' | 'improve' | null

  /**
   * True once the active project has unsaved edits.
   *
   * False immediately after selectTemplate(), generateAiProject(), or
   * clearProject() — a freshly loaded (or absent) project is never dirty.
   * Set to true by the first updateFirmware() call after a document is
   * (re)loaded. Nothing in Slice 29 ever resets it back to false — that
   * begins with Save in Slice 30.
   */
  projectDirty: boolean

  /**
   * Absolute path of the file the active project was last saved to or
   * opened from.
   *
   * Null on startup and after clearProject(), selectTemplate(), or
   * generateAiProject() — Slice 29 introduces this field but nothing in
   * this slice ever assigns it a non-null value. Populated starting with
   * Save (Slice 30) and Open (Slice 31).
   */
  currentProjectPath: string | null

  /**
   * True while saveProject() or saveAsProject() is awaiting the IPC response.
   *
   * Reset to false in the finally block of both actions, regardless of
   * outcome — including a cancelled Save As dialog.
   */
  projectSaving: boolean

  /**
   * How the active project was most recently saved.
   *
   * Null until the first successful save. Set to 'manual' by saveProject()
   * and saveAsProject(); 'autosave' is written starting in Slice 32.
   */
  lastSaveType: 'manual' | 'autosave' | null

  /**
   * ISO 8601 timestamp of the most recent successful save.
   *
   * Null until the first successful save. This is the only save-timestamp
   * state held by the store — the "Saved X ago" text shown in TopBar is
   * computed from this value at render/interval time and is never itself
   * stored here or persisted.
   */
  lastSavedAt: string | null

  /**
   * Human-readable error message from the last failed saveProject(),
   * saveAsProject(), or deleteProject() call.
   *
   * Null on startup, cleared at the start of each new saveProject()/
   * saveAsProject() call, and set when ProjectService returns a typed error
   * from any of the three writers above. A cancelled Save As dialog is NOT
   * an error and never sets this field.
   *
   * openProject() and generateAiProject() deliberately use their own
   * separate error fields (projectOpenError, aiError) instead of this one —
   * each operation's failure state is independent, never shared.
   */
  projectError: string | null

  /**
   * All entries in the recent-projects registry, most recently saved/opened
   * first.
   *
   * Loaded exactly once, at application startup, by AppProviders.tsx's mount
   * effect. Nothing else refreshes it — a project saved, opened, or removed
   * mid-session will not be reflected here until the app restarts. This is
   * an accepted, explicit limitation of Slice 31; automatic synchronization
   * is deferred to a later slice.
   */
  recentProjects: IRecentProject[]

  /**
   * True while openProject() is awaiting the IPC response.
   *
   * Reset to false in the finally block, unconditionally — including after
   * a thrown transport failure — so it can never get stuck true.
   */
  projectOpening: boolean

  /**
   * Human-readable error message from the last failed openProject() call.
   *
   * Null on startup, cleared at the start of each new openProject() call
   * (and again on that call's success), and set only when that call fails.
   * Entirely independent of projectError — opening and saving are separate
   * operations with separate state, never shared.
   */
  projectOpenError: string | null

  // -------------------------------------------------------------------------
  // AI Configuration State (Phase 8, Slice 35)
  //
  // Persisted AI provider configuration (apiUrl, model, whether an API key
  // is stored). The raw API key itself is never present in this state —
  // SettingsService never transmits it to the Renderer (mirrors
  // IAIProviderConfig's existing Main-process-only rule).
  // -------------------------------------------------------------------------

  /**
   * The persisted AI provider configuration, as last loaded from or saved
   * to SettingsService. Null until loadAiConfig() resolves for the first
   * time.
   */
  aiConfig: IAiSettingsConfig | null

  /** True while loadAiConfig() is awaiting the IPC response. */
  aiConfigLoading: boolean

  /** True while saveAiConfig() is awaiting the IPC response. */
  aiConfigSaving: boolean

  /**
   * Human-readable error message from the last failed saveAiConfig() call.
   *
   * Null on startup and cleared at the start of each new saveAiConfig()
   * call. loadAiConfig() never sets this — a failed load silently leaves
   * aiConfig at its previous value, matching loadRecentProjects()'s
   * convention.
   */
  aiConfigError: string | null

  // -------------------------------------------------------------------------
  // Hardware State (Phase 2, Slice 6)
  //
  // The live hardware snapshot from the Main process.
  // Populated by initializeHardware() and updated via the push subscription.
  // -------------------------------------------------------------------------

  /** The current hardware snapshot. Default state before first IPC response. */
  hardware: IHardwareState

  /**
   * True once initializeHardware() has successfully subscribed to push events
   * and loaded the initial snapshot. Reset to false by disposeHardware().
   */
  hardwareInitialized: boolean

  /**
   * True while an async hardware operation (loadHardwareState / refreshHardware)
   * is in progress. Components use this to show loading indicators.
   */
  hardwareLoading: boolean

  /**
   * The last error message from a failed hardware operation.
   * Null when no error is present.
   */
  hardwareError: string | null

  // -------------------------------------------------------------------------
  // Upload State (Phase 3, Slice 10)
  //
  // Tracks the lifecycle of compile and upload operations.
  // All values are serializable — no runtime handles, no Promises.
  // -------------------------------------------------------------------------

  /**
   * True while a compile, upload, or compileAndUpload operation is in progress.
   * Reset to false in the finally block of every async upload action.
   */
  uploadLoading: boolean

  /**
   * Human-readable error message from the last failed upload operation.
   * Null when no error is present or when a new operation starts.
   * Sourced from ICompileResult.error or IUploadResult.error — never thrown.
   */
  uploadError: string | null

  /**
   * The typed result of the last compile operation.
   * Null before any compile has been attempted.
   * Replaced on every compileFirmware() call regardless of outcome.
   */
  lastCompileResult: ICompileResult | null

  /**
   * The typed result of the last upload or compileAndUpload operation.
   * Null before any upload has been attempted.
   * Replaced on every uploadFirmware() or compileAndUploadFirmware() call.
   */
  lastUploadResult: IUploadResult | null

  /**
   * The port most recently uploaded to successfully (Phase 8, Slice 38).
   *
   * Null until the first successful compileAndUploadFirmware() call. Set
   * only by that action's success branch — never by uploadFirmware() (not
   * called from any UI component), never by a failed upload, and never
   * cleared by any project-lifecycle action (this is Upload/Hardware domain
   * state, independent of project identity, matching lastUploadResult).
   *
   * Read by DeviceMonitor as a preference — not a forced override — for its
   * selectedPortPath derivation, so a successful upload naturally leads into
   * watching the board run without requiring the user to re-select the port.
   */
  lastUploadedPort: string | null

  // -------------------------------------------------------------------------
  // Serial State (Phase 4, Slice 16)
  //
  // Per-port session state and per-port bounded log storage.
  // Keyed by port path (e.g. "COM3", "/dev/ttyUSB0") to support multi-board
  // monitoring without crosstalk between sessions.
  //
  // All values are serializable — no runtime handles, no Promises, no
  // EventEmitters. Subscription handles live in module-level private variables.
  // -------------------------------------------------------------------------

  /**
   * Per-port session state map.
   *
   * Key:   OS port path (e.g. "COM3").
   * Value: ISerialSessionState snapshot for that port's live session.
   *
   * Updated by the serial:statusChanged push handler and by openSerial() /
   * closeSerial() as loading state transitions occur.
   */
  serialState: Record<string, ISerialSessionState>

  /**
   * Per-port log buffer.
   *
   * Key:   OS port path.
   * Value: Array of parsed lines (newest at the end).
   *
   * Bounded to 1000 lines per port. When the buffer is full, the oldest
   * line is discarded before the new one is appended.
   */
  serialLogs: Record<string, string[]>

  /**
   * When true the Serial Monitor UI scrolls to the latest line automatically
   * as new data arrives. Toggled by toggleSerialAutoScroll().
   */
  serialAutoScroll: boolean

  /**
   * Human-readable error from the last failed serial operation (open / close / write).
   * Null when no error is present or when a new operation starts.
   */
  serialError: string | null

  /**
   * True while an async serial operation (open / close / write) is in progress.
   * Reset to false in the finally block of every async serial action.
   */
  serialLoading: boolean

  // -------------------------------------------------------------------------
  // AI Actions (Phase 6, Slice 25)
  // -------------------------------------------------------------------------

  /**
   * Generates firmware from a natural-language prompt.
   *
   * Pipeline (all executed in the Main process via IPC):
   *   PromptBuilder → AIClient/MockAIClient → ResponseParser → ResponseValidator
   *   → IProjectDocument
   *
   * Lifecycle:
   *   1. Sets aiLoading = true and clears aiError.
   *   2. Calls window.api.ai.generate(request).
   *   3a. On success: stores the returned IProjectDocument in currentProjectDoc.
   *   3b. On typed error: sets aiError to the user-facing error message.
   *   3c. On IPC transport failure: captures the thrown error in aiError.
   *   4. Always sets aiLoading = false in finally.
   *
   * Never throws into React — all error paths produce a non-null aiError string.
   * Components never need a try/catch around this call.
   *
   * @param request - The generate request containing the user prompt and optional context.
   */
  generateAiProject: (request: IAIGenerateRequest) => Promise<void>

  /**
   * Requests an AI-assisted revision of the active project's firmware
   * (Phase 8, Slice 37).
   *
   * No-op (no IPC call, no state change) if currentProjectDoc is null —
   * there is nothing to improve. Otherwise builds an IAIGenerateRequest from
   * the active project (boardHint, and context.currentFirmware /
   * context.currentExplanation) and shares the exact same underlying
   * pipeline, loading/error lifecycle, and pending-candidate guard as
   * generateAiProject — the only difference is the resulting candidate is
   * stored with pendingAiCandidateMode: 'improve' instead of 'new'.
   *
   * Never throws into React. currentProjectDoc is left completely untouched
   * until the resulting candidate is explicitly accepted via
   * acceptAiCandidate().
   *
   * @param prompt - The natural-language improvement instruction.
   */
  improveAiProject: (prompt: string) => Promise<void>

  /**
   * Clears the active project, resetting all project-related state to null.
   *
   * Resets:
   * - currentProjectDoc → null
   * - aiError           → null
   *
   * Does NOT reset aiLoading — if a generation is in progress, the loading
   * indicator should remain until the operation completes.
   */
  clearProject: () => void

  // -------------------------------------------------------------------------
  // AI Candidate Review Actions (Phase 8, Slice 36)
  // -------------------------------------------------------------------------

  /**
   * Accepts the pending AI candidate, replacing currentProjectDoc with it.
   *
   * No-op if pendingAiCandidate is null.
   *
   * Cancels any pending autosave debounce first — the active project is
   * about to change, so a timer scheduled against the outgoing project must
   * never fire against the newly accepted one.
   *
   * Sets currentProjectDoc to the candidate, projectDirty = false,
   * currentProjectPath = null — identical to the values generateAiProject()
   * used to set directly before this slice. Clears pendingAiCandidate and
   * pendingAiCandidateMode.
   *
   * Pure synchronous action. No IPC. No side effects beyond the store.
   */
  acceptAiCandidate: () => void

  /**
   * Discards the pending AI candidate without applying it.
   *
   * No-op if pendingAiCandidate is null. Touches nothing except
   * pendingAiCandidate and pendingAiCandidateMode — currentProjectDoc,
   * projectDirty, currentProjectPath, and any running autosave debounce are
   * left completely untouched.
   *
   * Pure synchronous action. No IPC. No side effects beyond the store.
   */
  discardAiCandidate: () => void

  // -------------------------------------------------------------------------
  // AI Configuration Actions (Phase 8, Slice 35)
  // -------------------------------------------------------------------------

  /**
   * Loads the persisted AI provider configuration into aiConfig.
   *
   * Called once, from AppProviders.tsx's mount effect, matching
   * loadRecentProjects()'s lifecycle exactly.
   *
   * Never throws into React — a transport failure silently leaves aiConfig
   * at its previous value (null on first load).
   */
  loadAiConfig: () => Promise<void>

  /**
   * Saves the given AI provider configuration via SettingsService.
   *
   * Lifecycle:
   *   1. Sets aiConfigSaving = true and clears aiConfigError.
   *   2. Calls window.api.settings.saveAiConfig(request).
   *   3a. On success: re-fetches aiConfig via loadAiConfig() so hasApiKey
   *       reflects the authoritative Main-process state, rather than being
   *       computed locally from request.apiKey's unchanged/clear/set meaning.
   *   3b. On error: sets aiConfigError to the typed error message.
   *   3c. On IPC transport failure: captures the thrown error in
   *       aiConfigError.
   *   4. Always sets aiConfigSaving = false in finally.
   *
   * Never throws into React. Returns the typed result so the caller (the
   * Settings page) can react directly, matching deleteProject()'s existing
   * return-value convention.
   */
  saveAiConfig: (request: IAiSettingsSaveRequest) => Promise<ISettingsSaveResult>

  // -------------------------------------------------------------------------
  // Firmware Editing Actions (Phase 7, Slice 29)
  // -------------------------------------------------------------------------

  /**
   * Replaces the active project's firmware source with Monaco's current
   * editor content and marks the project dirty.
   *
   * Immutability contract (ADR-016): constructs a new IProjectDocument via
   * spread — every field except firmware is carried over unchanged,
   * including id, which is never regenerated here (only selectTemplate()
   * and generateAiProject() mint a new id).
   *
   * No-op if currentProjectDoc is null — Monaco is never mounted without an
   * active project, so this path is not reachable through the UI, but the
   * guard keeps the action safe to call unconditionally.
   *
   * Pure synchronous action. No IPC. No side effects beyond the store.
   *
   * @param firmware - The complete firmware source from Monaco's onChange.
   */
  updateFirmware: (firmware: string) => void

  // -------------------------------------------------------------------------
  // Project Management Actions (Phase 7, Slice 33)
  // -------------------------------------------------------------------------

  /**
   * Updates the active project's title and marks the project dirty.
   *
   * Immutability contract (ADR-016): constructs a new IProjectDocument via
   * spread — every field except title is carried over unchanged.
   *
   * No-op guards:
   * - currentProjectDoc is null (no active project)
   * - newTitle trims to empty string
   * - newTitle (trimmed) is already the current title (idempotent)
   *
   * Reuses the shared _scheduleAutosave(3000) helper so title edits and
   * firmware edits follow the exact same 3-second debounce policy.
   * An optimistic recents-list update is applied immediately; the
   * authoritative registry update happens on the next successful autosave.
   *
   * @param newTitle - The new project title (will be trimmed before use).
   */
  updateTitle: (newTitle: string) => void

  /**
   * Deletes a project file and its recents entry via the project:delete IPC channel.
   *
   * Lifecycle:
   *   1. No-op if filePath is empty.
   *   2. Calls window.api.project.delete({ filePath }).
   *   3a. On success: removes the entry from recentProjects. If the deleted
   *       project is the currently active one (currentProjectPath === filePath),
   *       delegates to clearProject() — no state duplication.
   *   3b. On error: sets projectError to the typed error message.
   *   3c. On IPC transport failure: captures the thrown error in projectError.
   *
   * Never throws into React.
   *
   * @param filePath - The absolute path of the project file to delete.
   */
  deleteProject: (filePath: string) => Promise<IProjectDeleteResult>

  // -------------------------------------------------------------------------
  // Project Persistence Actions (Phase 7, Slice 30)
  // -------------------------------------------------------------------------

  /**
   * Saves the active project to its existing path.
   *
   * If currentProjectPath is null (never saved before), delegates to
   * saveAsProject() instead — project:save is never invoked without a
   * concrete path (ADR-P7-015).
   *
   * Lifecycle:
   *   1. No-op if currentProjectDoc is null.
   *   2. Captures the target path at invocation (stale-response guard): if
   *      currentProjectPath has changed by the time the response arrives
   *      (e.g. a different project became active), the response is
   *      discarded — nothing is applied except step 5.
   *   3. Sets projectSaving = true and clears projectError.
   *   4. Calls window.api.project.save({ document, filePath }).
   *   5a. On success (and not stale): currentProjectPath, projectDirty = false,
   *       lastSaveType = 'manual', lastSavedAt, projectError = null.
   *   5b. On error (and not stale): projectError = error.
   *   5c. On IPC transport failure: captures the thrown error in projectError.
   *   6. Always sets projectSaving = false in finally, regardless of staleness.
   *
   * Never throws into React. Components never need a try/catch around this call.
   */
  saveProject: () => Promise<void>

  /**
   * Saves the active project to a user-chosen location via the native
   * Save dialog.
   *
   * Lifecycle:
   *   1. No-op if currentProjectDoc is null.
   *   2. Sets projectSaving = true and clears projectError.
   *   3. Calls window.api.project.saveAs({ document, suggestedTitle }).
   *   4a. On success: currentProjectPath, projectDirty = false,
   *       lastSaveType = 'manual', lastSavedAt, projectError = null.
   *   4b. On cancellation: no state mutation at all. The user dismissing the
   *       native dialog is a normal action, not a failure — projectError is
   *       never set for this outcome.
   *   4c. On error: projectError = error.
   *   4d. On IPC transport failure: captures the thrown error in projectError.
   *   5. Always sets projectSaving = false in finally, including after a
   *      cancellation.
   *
   * Never throws into React. Components never need a try/catch around this call.
   */
  saveAsProject: () => Promise<void>

  // -------------------------------------------------------------------------
  // Project Persistence Actions (Phase 7, Slice 31)
  // -------------------------------------------------------------------------

  /**
   * Opens a project from an already-known absolute path (the Recent
   * Projects flow — no native file-picker exists yet).
   *
   * Lifecycle:
   *   1. Sets projectOpening = true and clears projectOpenError.
   *   2. Calls window.api.project.open({ filePath }).
   *   3a. On success: currentProjectDoc, currentProjectPath, lastSavedAt are
   *       restored from the result; projectDirty = false. lastSaveType is
   *       reset to null — opening is not a save, so it must never claim
   *       'manual'. projectOpenError = null.
   *   3b. On error: projectOpenError = error. Whatever project (if any) was
   *       already active is left completely untouched.
   *   3c. On IPC transport failure: captures the thrown error in
   *       projectOpenError, leaving the active project untouched.
   *   4. Always sets projectOpening = false in finally.
   *
   * Never reads or writes projectSaving/projectError — opening and saving
   * are independent operations with independent state.
   * Never throws into React. Components never need a try/catch around this call.
   */
  openProject: (filePath: string) => Promise<void>

  /**
   * Loads the full recent-projects registry into recentProjects.
   *
   * Called exactly once, from AppProviders.tsx's mount effect. Nothing else
   * calls this — recentProjects is not refreshed after save, saveAs, open,
   * or a stale-entry removal within the same session (accepted limitation,
   * Slice 31).
   *
   * Never throws into React — a transport failure silently leaves
   * recentProjects at its previous value.
   */
  loadRecentProjects: () => Promise<void>

  // -------------------------------------------------------------------------
  // Project Persistence Actions (Phase 7, Slice 32)
  // -------------------------------------------------------------------------

  /**
   * Autosaves the active project to its last known path.
   *
   * No-op (no IPC call) if there is no active project, no known path, or a
   * manual save (projectSaving) is already in flight — the next debounce
   * cycle will retry naturally; nothing is queued.
   *
   * On success, writes nothing itself: lastSaveType/lastSavedAt/projectDirty
   * are updated exclusively by the project:saved push subscription
   * (initializeProjectSync()), decoupling "who triggered the write" from
   * "who updates the store".
   *
   * On a typed error or thrown transport failure: logged via console.error
   * only. Never mutates projectError, projectOpenError, or any other state —
   * autosave failures are background failures with no UI.
   *
   * Never throws into React.
   */
  autosaveProject: () => Promise<void>

  /**
   * Subscribes to project:saved push events from the Main process.
   *
   * Applies a staleness guard: only updates lastSaveType/lastSavedAt/
   * projectDirty when payload.filePath matches the currently active
   * project's path — a push for a project that's no longer active is
   * discarded.
   *
   * Safe to call multiple times — subsequent calls are no-ops, matching
   * initializeSerial()'s guard pattern.
   */
  initializeProjectSync: () => void

  /**
   * Unsubscribes from project:saved push events.
   * Nulls the private unsubscribe handle. Safe to call multiple times.
   */
  disposeProjectSync: () => void

  // -------------------------------------------------------------------------
  // UI Actions
  // -------------------------------------------------------------------------

  toggleSidebar: () => void
  setTheme: (theme: 'dark' | 'light') => void

  // -------------------------------------------------------------------------
  // Hardware Actions (Phase 2, Slice 6)
  // -------------------------------------------------------------------------

  /**
   * Initializes the hardware subscription.
   *
   * Steps:
   * 1. Guards against duplicate subscriptions.
   * 2. Subscribes to window.api.hardware.onStateChanged() push events.
   *    Each push updates the `hardware` slice directly in the store.
   * 3. Loads the current snapshot via loadHardwareState() so state is
   *    populated immediately without waiting for the first push event.
   * 4. Sets hardwareInitialized = true on success.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   * Call this once from the application root (e.g. AppProviders).
   */
  initializeHardware: () => Promise<void>

  /**
   * Fetches the current hardware snapshot without triggering any I/O.
   * Updates the hardware slice, loading state, and error state.
   *
   * Used for the initial state load inside initializeHardware().
   * May also be called independently if a one-shot read is needed.
   */
  loadHardwareState: () => Promise<void>

  /**
   * Forces an out-of-cycle hardware re-scan (CLI re-detection + port poll
   * + board re-identification) and updates the store with the result.
   *
   * The Main process will also emit a push event as a side effect, which
   * the subscription handles automatically. The store will therefore be
   * updated twice — once from the invoke response and once from the push.
   * Both updates are idempotent and safe.
   *
   * Updates loading state during the async operation.
   * Captures failures in hardwareError — never throws into React.
   */
  refreshHardware: () => Promise<void>

  /**
   * Removes the hardware push subscription and resets hardwareInitialized.
   *
   * Call this in the application root cleanup (e.g. on unmount or quit).
   * The hardware state itself is NOT reset so the UI does not flicker if
   * the component briefly unmounts and remounts.
   */
  disposeHardware: () => void

  // -------------------------------------------------------------------------
  // Upload Actions (Phase 3, Slice 10)
  // -------------------------------------------------------------------------

  /**
   * Compiles firmware source only. Does not upload.
   *
   * Updates uploadLoading while the compile operation is in progress.
   * Stores the typed ICompileResult (success or error) in lastCompileResult.
   * On failure, sets uploadError to the human-readable error message.
   * Never throws into React — all errors are captured in store state.
   *
   * Use this when you need the compiled artifact to pass to uploadFirmware()
   * separately (e.g. compile-once / upload-many workflows).
   */
  compileFirmware: (request: IUploadRequest) => Promise<void>

  /**
   * Uploads a previously compiled firmware artifact to the target board.
   *
   * Takes the ICompiledFirmware artifact produced by a prior compileFirmware()
   * call (available inside lastCompileResult on success). The artifact is spent
   * after this call — UploadService cleans up the temp build directory.
   *
   * Updates uploadLoading while the upload is in progress.
   * Stores the typed IUploadResult in lastUploadResult.
   * On failure, sets uploadError to the human-readable error message.
   * Never throws into React.
   */
  uploadFirmware: (firmware: ICompiledFirmware) => Promise<void>

  /**
   * Compiles firmware source then uploads to the target board in one call.
   *
   * This is the primary action for the one-click upload workflow in V0.1.
   * Stops and stores the compile error if compilation fails — no upload
   * is attempted in that case.
   *
   * Updates uploadLoading while the operation is in progress.
   * Stores the typed IUploadResult in lastUploadResult.
   * On failure, sets uploadError to the human-readable error message.
   * Never throws into React.
   */
  compileAndUploadFirmware: (request: IUploadRequest) => Promise<void>

  // -------------------------------------------------------------------------
  // Serial Actions (Phase 4, Slice 16)
  // -------------------------------------------------------------------------

  /**
   * Initializes the serial push subscriptions.
   *
   * Steps:
   * 1. Guards against duplicate subscriptions (checks the module-level
   *    _serialDataUnsubscribe / _serialStatusUnsubscribe handles).
   * 2. Subscribes to window.api.serial.onData() — routes each line to the
   *    correct per-port log buffer, enforcing the 1000-line bound.
   * 3. Subscribes to window.api.serial.onStatusChanged() — updates the
   *    per-port ISerialSessionState in serialState.
   *
   * Unsubscribe handles are stored in module-level private variables,
   * not in the store — they are runtime resources, not application state.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  initializeSerial: () => void

  /**
   * Removes both serial push subscriptions.
   *
   * Nulls the private unsubscribe handles.
   * Safe to call multiple times — subsequent calls are no-ops.
   * Does NOT reset serialState or serialLogs — session history is preserved.
   */
  disposeSerial: () => void

  /**
   * Opens a new serial session on the specified port.
   *
   * Sets serialLoading = true before the IPC call.
   * On success, the serial:statusChanged push will update serialState.
   * On typed IPC error, stores the message in serialError.
   * On transport failure, captures the thrown error in serialError.
   * Always clears serialLoading in finally.
   */
  openSerial: (request: ISerialOpenRequest) => Promise<void>

  /**
   * Closes the active serial session for the specified port.
   *
   * Same loading/error lifecycle as openSerial.
   * On success, the serial:statusChanged push will update serialState.
   */
  closeSerial: (request: ISerialCloseRequest) => Promise<void>

  /**
   * Writes text to the active serial session for the specified port.
   *
   * Same loading/error lifecycle as openSerial.
   * The newline terminator is applied server-side per request.newline.
   */
  writeSerial: (request: ISerialWriteRequest) => Promise<void>

  /**
   * Clears the log buffer for the specified port only.
   *
   * Does not affect other ports. Idempotent if the port has no logs.
   */
  clearSerialLogs: (port: string) => void

  /**
   * Toggles the global auto-scroll preference between true and false.
   */
  toggleSerialAutoScroll: () => void

  // -------------------------------------------------------------------------
  // Template Actions (Phase 5, Slice 20 — updated in Slice 25)
  // -------------------------------------------------------------------------

  /**
   * Selects a template and normalises it into an IProjectDocument.
   *
   * Called by the Projects page when the user clicks a TemplateCard.
   * Maps ITemplateDefinition → IProjectDocument so that the Editor page can
   * read firmware, explanation, components, wiring, and expectedOutput from
   * a single, unified source: currentProjectDoc.
   *
   * Pure synchronous action. No IPC. No side effects.
   *
   * @param template - The template the user chose from the Template Gallery.
   */
  selectTemplate: (template: ITemplateDefinition) => void
}

// ---------------------------------------------------------------------------
// Private module-level runtime handles
//
// Subscription handles returned by window.api.hardware.onStateChanged() and
// window.api.serial.onData() / onStatusChanged().
// These are runtime resources, not application state — they must never enter
// the Zustand store. Stored at module scope so initialize/dispose pairs
// share the same reference across calls.
// ---------------------------------------------------------------------------

let _hardwareUnsubscribe: (() => void) | null = null

/**
 * Unsubscribe handle for window.api.serial.onData().
 * Null until initializeSerial() has been called.
 */
let _serialDataUnsubscribe: (() => void) | null = null

/**
 * Unsubscribe handle for window.api.serial.onStatusChanged().
 * Null until initializeSerial() has been called.
 */
let _serialStatusUnsubscribe: (() => void) | null = null

/**
 * Unsubscribe handle for window.api.project.onSaved().
 * Null until initializeProjectSync() has been called.
 */
let _projectSavedUnsubscribe: (() => void) | null = null

/**
 * Autosave debounce timer (Phase 7, Slice 32). Owned exclusively by
 * updateFirmware(): every call clears any pending timer and starts a new
 * one, so exactly one autosaveProject() call fires per 3-second window of
 * inactivity — never one per edit, never on a fixed schedule. Also cleared
 * whenever the active project changes (openProject, selectTemplate,
 * generateAiProject, clearProject) so a timer scheduled by one project can
 * never fire against a different, subsequently active one.
 *
 * A runtime resource, not application state — must never enter the Zustand
 * store, matching the push-event unsubscribe handles above.
 */
const AUTOSAVE_DEBOUNCE_MS = 3000
let _autosaveDebounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Shared internal helper: clears any pending autosave debounce timer, if one
 * is set. A no-op if none is pending.
 *
 * Called whenever the active project changes (openProject, selectTemplate,
 * generateAiProject, clearProject, deleteProject) or is superseded by a
 * manual save (saveProject, saveAsProject), so a timer scheduled against one
 * project/state can never fire against a different, subsequently active one.
 *
 * Extracted (Phase 7, Slice 34) to replace six previously-duplicated inline
 * copies of this exact logic — purely a de-duplication, no behavior change.
 */
function cancelPendingAutosave(): void {
  if (_autosaveDebounceTimer !== null) {
    clearTimeout(_autosaveDebounceTimer)
    _autosaveDebounceTimer = null
  }
}

/**
 * Shared internal helper: clears any pending autosave timer and schedules a
 * new one after `delayMs`. When the timer fires, it calls autosaveProject().
 *
 * Extracted so that both updateFirmware() and updateTitle() can share the
 * exact same 3-second debounce policy without duplicating timer logic.
 *
 * Must only be called when currentProjectDoc is non-null — callers are
 * responsible for this guard.
 */
function scheduleAutosave(delayMs: number, getStore: () => AppState): void {
  cancelPendingAutosave()
  _autosaveDebounceTimer = setTimeout(() => {
    _autosaveDebounceTimer = null
    void getStore().autosaveProject()
  }, delayMs)
}

/**
 * Shared internal helper (Phase 8, Slice 37): runs the AI generation pipeline
 * common to both generateAiProject() and improveAiProject() — the
 * pending-candidate guard, the preload-availability guard, the
 * aiLoading/aiError/aiErrorCode lifecycle, and the pending-candidate
 * assignment on success. The only difference between the two callers is the
 * constructed IAIGenerateRequest and the `mode` tag applied to a successful
 * result.
 *
 * Extracted so improveAiProject() does not duplicate this logic — reuse,
 * not duplication, matching this file's existing scheduleAutosave()
 * extraction (Slice 34).
 */
async function runAiGeneration(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  request: IAIGenerateRequest,
  mode: 'new' | 'improve'
): Promise<void> {
  // Guard: a candidate is already pending review — must be resolved
  // (accepted or discarded) before a new generation can start.
  if (get().pendingAiCandidate) return

  // Guard: preload bridge must be available
  if (!window.api?.ai) {
    set({ aiError: 'AI API is not available.', aiErrorCode: null, aiLoading: false })
    return
  }

  set({ aiLoading: true, aiError: null, aiErrorCode: null })

  try {
    const result = await window.api.ai.generate(request)

    if (result.status === 'success') {
      // currentProjectDoc is deliberately left untouched here — see
      // acceptAiCandidate() for where the active project actually changes.
      set({ pendingAiCandidate: result.project, pendingAiCandidateMode: mode })
    } else {
      set({ aiError: result.error, aiErrorCode: result.code })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed unexpectedly.'
    set({ aiError: message })
  } finally {
    set({ aiLoading: false })
  }
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>((set, get) => ({
  // -------------------------------------------------------------------------
  // UI State
  // -------------------------------------------------------------------------

  sidebarCollapsed: false,
  currentTheme: 'dark',

  // -------------------------------------------------------------------------
  // AI / Project State initial values (Phase 6, Slice 25)
  // -------------------------------------------------------------------------

  currentProjectDoc: null,
  aiLoading: false,
  aiError: null,
  aiErrorCode: null,
  pendingAiCandidate: null,
  pendingAiCandidateMode: null,
  projectDirty: false,
  currentProjectPath: null,
  projectSaving: false,
  lastSaveType: null,
  lastSavedAt: null,
  projectError: null,
  recentProjects: [],
  projectOpening: false,
  projectOpenError: null,

  // -------------------------------------------------------------------------
  // AI Configuration State initial values (Phase 8, Slice 35)
  // -------------------------------------------------------------------------

  aiConfig: null,
  aiConfigLoading: false,
  aiConfigSaving: false,
  aiConfigError: null,

  // -------------------------------------------------------------------------
  // Hardware State initial values
  // -------------------------------------------------------------------------

  hardware: DEFAULT_HARDWARE_STATE,
  hardwareInitialized: false,
  hardwareLoading: false,
  hardwareError: null,

  // -------------------------------------------------------------------------
  // Upload State initial values (Phase 3, Slice 10)
  // -------------------------------------------------------------------------

  uploadLoading: false,
  uploadError: null,
  lastCompileResult: null,
  lastUploadResult: null,
  lastUploadedPort: null,

  // -------------------------------------------------------------------------
  // Serial State initial values (Phase 4, Slice 16)
  // -------------------------------------------------------------------------

  serialState: {},
  serialLogs: {},
  serialAutoScroll: true,
  serialError: null,
  serialLoading: false,

  // -------------------------------------------------------------------------
  // UI Actions
  // -------------------------------------------------------------------------

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ currentTheme: theme }),

  // -------------------------------------------------------------------------
  // Hardware Actions
  // -------------------------------------------------------------------------

  initializeHardware: async () => {
    // Guard: prevent duplicate subscriptions
    if (get().hardwareInitialized) return

    // Guard: preload bridge must be available (not present in test environments)
    if (!window.api?.hardware) {
      set({
        hardwareError: 'Hardware API is not available.',
        hardwareInitialized: false
      })
      return
    }

    // Step 1: Subscribe to push events from the Main process.
    // Each incoming state update replaces the entire hardware snapshot.
    // The unsubscribe handle is stored in the module-level private variable,
    // not in the store — it is a runtime resource, not application state.
    _hardwareUnsubscribe = window.api.hardware.onStateChanged((state: IHardwareState) => {
      set({ hardware: state, hardwareError: null })
    })

    set({ hardwareInitialized: true })

    // Step 2: Load the initial snapshot so state is populated immediately
    // without waiting for the first push event from the Main process.
    await get().loadHardwareState()
  },

  loadHardwareState: async () => {
    if (!window.api?.hardware) return

    set({ hardwareLoading: true, hardwareError: null })

    try {
      const state = await window.api.hardware.getState()
      set({ hardware: state, hardwareLoading: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load hardware state.'
      set({ hardwareLoading: false, hardwareError: message })
    }
  },

  refreshHardware: async () => {
    if (!window.api?.hardware) return

    set({ hardwareLoading: true, hardwareError: null })

    try {
      const state = await window.api.hardware.refresh()
      set({ hardware: state, hardwareLoading: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh hardware.'
      set({ hardwareLoading: false, hardwareError: message })
    }
  },

  disposeHardware: () => {
    if (_hardwareUnsubscribe) {
      _hardwareUnsubscribe()
      _hardwareUnsubscribe = null
    }

    set({ hardwareInitialized: false })
  },

  // -------------------------------------------------------------------------
  // Upload Actions (Phase 3, Slice 10)
  // -------------------------------------------------------------------------

  compileFirmware: async (request: IUploadRequest) => {
    if (!window.api?.upload) return

    set({ uploadLoading: true, uploadError: null })

    try {
      const result = await window.api.upload.compile(request)
      set({ lastCompileResult: result })

      if (result.status === 'error') {
        set({ uploadError: result.error })
      }
    } catch (err: unknown) {
      // IPC transport errors — UploadService itself never throws,
      // but the IPC layer can fail if the Main process is unavailable.
      const message = err instanceof Error ? err.message : 'Compilation failed unexpectedly.'
      set({ uploadError: message })
    } finally {
      set({ uploadLoading: false })
    }
  },

  uploadFirmware: async (firmware: ICompiledFirmware) => {
    if (!window.api?.upload) return

    set({ uploadLoading: true, uploadError: null })

    try {
      const result = await window.api.upload.upload(firmware)
      set({ lastUploadResult: result })

      if (result.status === 'error') {
        set({ uploadError: result.error })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.'
      set({ uploadError: message })
    } finally {
      set({ uploadLoading: false })
    }
  },

  compileAndUploadFirmware: async (request: IUploadRequest) => {
    if (!window.api?.upload) return

    set({ uploadLoading: true, uploadError: null })

    try {
      const result = await window.api.upload.compileAndUpload(request)
      set({ lastUploadResult: result })

      if (result.status === 'success') {
        set({ lastUploadedPort: request.port })
      } else {
        set({ uploadError: result.error })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Compile and upload failed unexpectedly.'
      set({ uploadError: message })
    } finally {
      set({ uploadLoading: false })
    }
  },

  // -------------------------------------------------------------------------
  // Serial Actions (Phase 4, Slice 16)
  // -------------------------------------------------------------------------

  initializeSerial: () => {
    // Guard: prevent duplicate subscriptions
    if (_serialDataUnsubscribe !== null || _serialStatusUnsubscribe !== null) return

    // Guard: preload bridge must be available
    if (!window.api?.serial) {
      set({ serialError: 'Serial API is not available.' })
      return
    }

    // Subscribe to serial:data push events.
    // Each event carries a single parsed line for a specific port.
    // Route the line to the correct per-port log buffer, enforcing the
    // 1000-line maximum. Entries beyond the limit are dropped from the front.
    _serialDataUnsubscribe = window.api.serial.onData((payload: ISerialDataPayload) => {
      set((state) => {
        const existingLogs = state.serialLogs[payload.port] ?? []
        const MAX_LINES = 1000

        // Append the new line; if at capacity, drop the oldest entry.
        const updatedLogs =
          existingLogs.length >= MAX_LINES
            ? [...existingLogs.slice(1), payload.line]
            : [...existingLogs, payload.line]

        return {
          serialLogs: {
            ...state.serialLogs,
            [payload.port]: updatedLogs
          }
        }
      })
    })

    // Subscribe to serial:statusChanged push events.
    // Each event carries the port and its new lifecycle status.
    // Only the affected port's ISerialSessionState is mutated — all other
    // ports remain untouched.
    _serialStatusUnsubscribe = window.api.serial.onStatusChanged(
      (payload: ISerialStatusPayload) => {
        set((state) => {
          const existing = state.serialState[payload.port]

          // Preserve the session's settings if they were stored on open.
          // If the session was never opened (unexpected status from the Main
          // process), fall back to safe defaults so the state is never invalid.
          const updatedSession: ISerialSessionState = {
            port: payload.port,
            status: payload.status,
            settings: existing?.settings ?? { baudRate: 9600, newline: 'crlf' },
            error: payload.error
          }

          return {
            serialState: {
              ...state.serialState,
              [payload.port]: updatedSession
            }
          }
        })
      }
    )
  },

  disposeSerial: () => {
    if (_serialDataUnsubscribe) {
      _serialDataUnsubscribe()
      _serialDataUnsubscribe = null
    }

    if (_serialStatusUnsubscribe) {
      _serialStatusUnsubscribe()
      _serialStatusUnsubscribe = null
    }
  },

  openSerial: async (request: ISerialOpenRequest) => {
    if (!window.api?.serial) return

    set({ serialLoading: true, serialError: null })

    // Optimistically record the session as 'connecting' so the UI can react
    // immediately without waiting for the serial:statusChanged push event.
    set((state) => ({
      serialState: {
        ...state.serialState,
        [request.port]: {
          port: request.port,
          status: 'connecting',
          settings: request.settings,
          error: null
        }
      }
    }))

    try {
      const result = await window.api.serial.open(request)

      if (result.status === 'error') {
        // The serial:statusChanged push will NOT arrive on failure —
        // update the session state here to reflect the error.
        set((state) => ({
          serialError: result.error,
          serialState: {
            ...state.serialState,
            [request.port]: {
              port: request.port,
              status: 'error',
              settings: request.settings,
              error: result.error
            }
          }
        }))
      }
      // On success: serial:statusChanged (connected) will arrive via push
      // and update serialState automatically.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open serial port.'
      set((state) => ({
        serialError: message,
        serialState: {
          ...state.serialState,
          [request.port]: {
            port: request.port,
            status: 'error',
            settings: request.settings,
            error: message
          }
        }
      }))
    } finally {
      set({ serialLoading: false })
    }
  },

  closeSerial: async (request: ISerialCloseRequest) => {
    if (!window.api?.serial) return

    set({ serialLoading: true, serialError: null })

    try {
      const result = await window.api.serial.close(request)

      if (result.status === 'error') {
        set({ serialError: result.error })
      }
      // On success: serial:statusChanged (closed) will arrive via push
      // and update serialState automatically.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close serial port.'
      set({ serialError: message })
    } finally {
      set({ serialLoading: false })
    }
  },

  writeSerial: async (request: ISerialWriteRequest) => {
    if (!window.api?.serial) return

    set({ serialLoading: true, serialError: null })

    try {
      const result = await window.api.serial.write(request)

      if (result.status === 'error') {
        set({ serialError: result.error })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to write to serial port.'
      set({ serialError: message })
    } finally {
      set({ serialLoading: false })
    }
  },

  clearSerialLogs: (port: string) => {
    set((state) => ({
      serialLogs: {
        ...state.serialLogs,
        [port]: []
      }
    }))
  },

  toggleSerialAutoScroll: () => {
    set((state) => ({ serialAutoScroll: !state.serialAutoScroll }))
  },

  // -------------------------------------------------------------------------
  // AI Actions (Phase 6, Slice 25)
  // -------------------------------------------------------------------------

  generateAiProject: async (request: IAIGenerateRequest) => {
    await runAiGeneration(set, get, request, 'new')
  },

  improveAiProject: async (prompt: string) => {
    // No-op if there is no active project — there is nothing to improve.
    const { currentProjectDoc } = get()
    if (!currentProjectDoc) return

    const request: IAIGenerateRequest = {
      prompt,
      boardHint: currentProjectDoc.boardHint,
      context: {
        currentFirmware: currentProjectDoc.firmware,
        currentExplanation: currentProjectDoc.explanation ?? undefined
      }
    }

    await runAiGeneration(set, get, request, 'improve')
  },

  clearProject: () => {
    // Resets all project-related state atomically.
    // currentProjectDoc, aiError, projectDirty, and currentProjectPath are
    // cleared together because they all describe the same concept: the
    // currently active project. There is nothing to be dirty or have a path
    // when there is no project.
    //
    // aiLoading is intentionally NOT reset here — if a generation is in progress,
    // the loading indicator must remain until the operation's finally block fires.
    //
    // The active project is changing — cancel any pending autosave debounce
    // so it can never fire against whatever becomes active next.
    cancelPendingAutosave()

    set({
      currentProjectDoc: null,
      aiError: null,
      projectDirty: false,
      currentProjectPath: null,
      pendingAiCandidate: null,
      pendingAiCandidateMode: null
    })
  },

  // -------------------------------------------------------------------------
  // AI Candidate Review Actions (Phase 8, Slice 36; extended Slice 37)
  // -------------------------------------------------------------------------

  acceptAiCandidate: () => {
    const { pendingAiCandidate, pendingAiCandidateMode, currentProjectDoc } = get()
    if (!pendingAiCandidate) return

    // The active project is changing — cancel any pending autosave debounce
    // so it can never fire against the project being replaced/updated now.
    cancelPendingAutosave()

    if (pendingAiCandidateMode === 'improve' && currentProjectDoc) {
      // Improve updates the existing project in place (Phase 8, Slice 37):
      // re-stamp the candidate with the original project's id and leave
      // currentProjectPath untouched, matching IProjectDocument.id's own
      // documented contract that it is never regenerated on save, rename,
      // autosave, or reload. The content differs from what's on disk, so
      // the project is now dirty and an autosave is scheduled exactly as
      // updateFirmware() already does.
      const updatedDoc: IProjectDocument = { ...pendingAiCandidate, id: currentProjectDoc.id }

      set({
        currentProjectDoc: updatedDoc,
        projectDirty: true,
        pendingAiCandidate: null,
        pendingAiCandidateMode: null
      })

      scheduleAutosave(AUTOSAVE_DEBOUNCE_MS, get)
      return
    }

    // 'new' mode: identical to the pre-Slice-37 behavior — the candidate's
    // own freshly minted id is adopted and there is no prior save path.
    set({
      currentProjectDoc: pendingAiCandidate,
      projectDirty: false,
      currentProjectPath: null,
      pendingAiCandidate: null,
      pendingAiCandidateMode: null
    })
  },

  discardAiCandidate: () => {
    if (!get().pendingAiCandidate) return
    set({ pendingAiCandidate: null, pendingAiCandidateMode: null })
  },

  // -------------------------------------------------------------------------
  // AI Configuration Actions (Phase 8, Slice 35)
  // -------------------------------------------------------------------------

  loadAiConfig: async () => {
    if (!window.api?.settings) return

    set({ aiConfigLoading: true })

    try {
      const aiConfig = await window.api.settings.getAiConfig()
      set({ aiConfig, aiConfigLoading: false })
    } catch {
      // Best-effort — a transport failure leaves aiConfig unchanged,
      // matching loadRecentProjects()'s convention.
      set({ aiConfigLoading: false })
    }
  },

  saveAiConfig: async (request: IAiSettingsSaveRequest): Promise<ISettingsSaveResult> => {
    if (!window.api?.settings) {
      const err: ISettingsSaveResult = {
        status: 'error',
        code: 'unknown',
        error: 'Settings API is not available.'
      }
      set({ aiConfigError: err.error })
      return err
    }

    set({ aiConfigSaving: true, aiConfigError: null })

    try {
      const result = await window.api.settings.saveAiConfig(request)

      if (result.status === 'success') {
        // Re-fetch rather than locally computing hasApiKey — SettingsService
        // is the sole authority on the unchanged/clear/set outcome.
        await get().loadAiConfig()
      } else {
        set({ aiConfigError: result.error })
      }

      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed unexpectedly.'
      set({ aiConfigError: message })
      return { status: 'error', code: 'unknown', error: message }
    } finally {
      set({ aiConfigSaving: false })
    }
  },

  // -------------------------------------------------------------------------
  // Template Actions (Phase 5, Slice 20 — updated in Slice 25)
  // -------------------------------------------------------------------------

  selectTemplate: (template: ITemplateDefinition) => {
    // Map ITemplateDefinition → IProjectDocument so the Editor reads from
    // a single unified source (currentProjectDoc) regardless of project origin.
    //
    // ADR-016: all fields are set at construction time; no in-place mutation.
    const metadata: IProjectMetadata = {
      origin: 'template',
      createdAt: new Date().toISOString()
      // generator, provider, model are intentionally absent — they are only
      // meaningful for AI-generated projects.
    }

    const projectDoc: IProjectDocument = {
      id: nanoid(),
      schemaVersion: 1,
      title: template.name,
      description: template.description,
      firmware: template.firmware,
      explanation: template.description,
      components: template.components,
      wiring: template.wiring,
      expectedOutput: template.expectedOutput,
      // Use the first supported board as the board hint, or null if none declared.
      boardHint: template.boards.length > 0 ? template.boards[0] : null,
      metadata
    }

    // The active project is changing — cancel any pending autosave debounce
    // so it can never fire against the template being loaded now.
    cancelPendingAutosave()

    set({
      currentProjectDoc: projectDoc,
      // Clear any stale AI error from a previous generation attempt.
      aiError: null,
      // A freshly selected template is never dirty and has no saved path.
      projectDirty: false,
      currentProjectPath: null,
      // A pending candidate belongs to whatever project was active before —
      // it must never be accepted onto this newly selected template.
      pendingAiCandidate: null,
      pendingAiCandidateMode: null
    })
  },

  // -------------------------------------------------------------------------
  // Firmware Editing Actions (Phase 7, Slice 29)
  // -------------------------------------------------------------------------

  updateFirmware: (firmware: string) => {
    set((state) => {
      // No-op if there is no active project — Monaco is never mounted
      // without one, but this guard keeps the action safe to call
      // unconditionally.
      if (!state.currentProjectDoc) return state

      return {
        // Atomic replacement (ADR-016): every field except firmware is
        // carried over unchanged, including id — updateFirmware() never
        // mints a new one.
        currentProjectDoc: { ...state.currentProjectDoc, firmware },
        projectDirty: true
      }
    })

    // Autosave debounce (Slice 32): delegate to shared helper so firmware
    // edits and title edits use the exact same 3-second policy.
    if (get().currentProjectDoc) {
      scheduleAutosave(AUTOSAVE_DEBOUNCE_MS, get)
    }
  },

  // -------------------------------------------------------------------------
  // Project Management Actions (Phase 7, Slice 33)
  // -------------------------------------------------------------------------

  updateTitle: (newTitle: string) => {
    const trimmed = newTitle.trim()
    if (!trimmed) return

    const { currentProjectDoc, currentProjectPath, recentProjects } = get()
    if (!currentProjectDoc) return
    if (trimmed === currentProjectDoc.title) return

    const newDoc = { ...currentProjectDoc, title: trimmed }

    // Optimistic recents update: reflect the new title immediately in the
    // list without waiting for the next autosave. The registry on disk is
    // updated on the next successful autosave (RecentProjectsService.push()).
    const updatedRecents = recentProjects.map((r) =>
      r.filePath === currentProjectPath ? { ...r, title: trimmed } : r
    )

    set({
      currentProjectDoc: newDoc,
      projectDirty: true,
      recentProjects: updatedRecents
    })

    // Reuse the shared 3-second debounce — same policy as firmware edits.
    scheduleAutosave(AUTOSAVE_DEBOUNCE_MS, get)
  },

  deleteProject: async (filePath: string): Promise<IProjectDeleteResult> => {
    // The active project may be about to be removed — cancel any pending
    // autosave debounce so it can never fire mid-delete (Slice 34). Does not
    // close the narrower window where an autosave IPC call was already in
    // flight when delete was invoked — that residual race is accepted,
    // consistent with the "quit during autosave" precedent (Slice 32).
    cancelPendingAutosave()

    if (!filePath) return { status: 'error', code: 'unknown', error: 'No file path provided.' }

    if (!window.api?.project) {
      const err: IProjectDeleteResult = {
        status: 'error',
        code: 'unknown',
        error: 'Project API is not available.'
      }
      set({ projectError: err.error })
      return err
    }

    try {
      const result = await window.api.project.delete({ filePath })

      if (result.status === 'success') {
        // Remove from the in-memory recents list immediately.
        set((state) => ({
          recentProjects: state.recentProjects.filter((r) => r.filePath !== filePath)
        }))

        // If the deleted project is the currently active one, reset all
        // active-project state via clearProject() — no duplication.
        if (get().currentProjectPath === filePath) {
          get().clearProject()
        }
      } else {
        set({ projectError: result.error })
      }

      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed unexpectedly.'
      set({ projectError: message })
      return { status: 'error', code: 'unknown', error: message }
    }
  },

  // -------------------------------------------------------------------------
  // Project Persistence Actions (Phase 7, Slice 30)
  // -------------------------------------------------------------------------

  saveProject: async () => {
    const { currentProjectDoc, currentProjectPath } = get()
    if (!currentProjectDoc) return

    // ADR-P7-015: project:save is never invoked without a concrete path —
    // redirect to the Save As flow instead.
    if (currentProjectPath === null) {
      await get().saveAsProject()
      return
    }

    if (!window.api?.project) {
      set({ projectError: 'Project API is not available.', projectSaving: false })
      return
    }

    // Stale-response guard: capture the target path now. If a different
    // project becomes active before the response arrives, discard the
    // response — only projectSaving still gets reset (in finally).
    const path = currentProjectPath
    set({ projectSaving: true, projectError: null })

    try {
      const result = await window.api.project.save({ document: currentProjectDoc, filePath: path })

      if (get().currentProjectPath !== path) return

      if (result.status === 'success') {
        // A successful manual save already persists the latest document —
        // any autosave debounce pending from before this save is now
        // obsolete and must not fire.
        cancelPendingAutosave()

        set({
          currentProjectPath: result.filePath,
          projectDirty: false,
          lastSaveType: 'manual',
          lastSavedAt: result.savedAt,
          projectError: null
        })
      } else {
        set({ projectError: result.error })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed unexpectedly.'
      if (get().currentProjectPath === path) {
        set({ projectError: message })
      }
    } finally {
      set({ projectSaving: false })
    }
  },

  saveAsProject: async () => {
    const { currentProjectDoc } = get()
    if (!currentProjectDoc) return

    if (!window.api?.project) {
      set({ projectError: 'Project API is not available.', projectSaving: false })
      return
    }

    set({ projectSaving: true, projectError: null })

    try {
      const result = await window.api.project.saveAs({
        document: currentProjectDoc,
        suggestedTitle: currentProjectDoc.title
      })

      if (result.status === 'success') {
        // A successful manual save already persists the latest document —
        // any autosave debounce pending from before this save is now
        // obsolete and must not fire.
        cancelPendingAutosave()

        set({
          currentProjectPath: result.filePath,
          projectDirty: false,
          lastSaveType: 'manual',
          lastSavedAt: result.savedAt,
          projectError: null
        })
      } else if (result.status === 'error') {
        set({ projectError: result.error })
      }
      // status === 'cancelled': no state mutation at all — a cancelled
      // native dialog is not an error (Slice 30, Ambiguity B, resolved).
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed unexpectedly.'
      set({ projectError: message })
    } finally {
      set({ projectSaving: false })
    }
  },

  // -------------------------------------------------------------------------
  // Project Persistence Actions (Phase 7, Slice 31)
  // -------------------------------------------------------------------------

  openProject: async (filePath: string) => {
    if (!window.api?.project) {
      set({ projectOpenError: 'Project API is not available.', projectOpening: false })
      return
    }

    set({ projectOpening: true, projectOpenError: null })

    try {
      const result = await window.api.project.open({ filePath })

      if (result.status === 'success') {
        // The active project is changing — cancel any pending autosave
        // debounce so it can never fire against the project being
        // opened now.
        cancelPendingAutosave()

        set({
          currentProjectDoc: result.document,
          currentProjectPath: result.filePath,
          projectDirty: false,
          lastSaveType: null,
          lastSavedAt: result.savedAt,
          projectOpenError: null,
          // A pending candidate belongs to whatever project was active
          // before — it must never be accepted onto this newly opened one.
          pendingAiCandidate: null,
          pendingAiCandidateMode: null
        })
      } else {
        set({ projectOpenError: result.error })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Open failed unexpectedly.'
      set({ projectOpenError: message })
    } finally {
      set({ projectOpening: false })
    }
  },

  loadRecentProjects: async () => {
    if (!window.api?.project) return

    try {
      const recentProjects = await window.api.project.getRecent()
      set({ recentProjects })
    } catch {
      // Best-effort — a transport failure leaves recentProjects unchanged.
    }
  },

  // -------------------------------------------------------------------------
  // Project Persistence Actions (Phase 7, Slice 32)
  // -------------------------------------------------------------------------

  autosaveProject: async () => {
    const { currentProjectDoc, currentProjectPath, projectSaving } = get()
    if (!currentProjectDoc || currentProjectPath === null || projectSaving) return

    if (!window.api?.project) return

    try {
      const result = await window.api.project.autosave({ document: currentProjectDoc })

      if (result.status === 'error') {
        console.error('[useAppStore] Autosave failed:', result.error)
      }
      // On success: lastSaveType/lastSavedAt/projectDirty are updated
      // exclusively by the project:saved push subscription, not here.
    } catch (err: unknown) {
      console.error('[useAppStore] Autosave failed unexpectedly:', err)
    }
  },

  initializeProjectSync: () => {
    // Guard: prevent duplicate subscriptions
    if (_projectSavedUnsubscribe !== null) return

    if (!window.api?.project) return

    _projectSavedUnsubscribe = window.api.project.onSaved((payload: IProjectSavedPayload) => {
      // Staleness guard: a push for a project that's no longer active is
      // discarded — the active project may have changed between the
      // autosave firing and this push arriving.
      if (get().currentProjectPath !== payload.filePath) return

      set({
        lastSaveType: payload.saveType,
        lastSavedAt: payload.savedAt,
        projectDirty: false
      })
    })
  },

  disposeProjectSync: () => {
    if (_projectSavedUnsubscribe) {
      _projectSavedUnsubscribe()
      _projectSavedUnsubscribe = null
    }
  }
}))
