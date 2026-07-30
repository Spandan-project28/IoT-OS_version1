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
 *   generateAiProject(request) → calls window.api.ai.generate(), stores IProjectDocument
 *                                 on success or sets aiError on failure. Never throws.
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
import type { IAIGenerateRequest } from '@shared/types/ai'

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
  projectDirty: false,
  currentProjectPath: null,

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

      if (result.status === 'error') {
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
    // Guard: preload bridge must be available
    if (!window.api?.ai) {
      set({ aiError: 'AI API is not available.', aiLoading: false })
      return
    }

    // Step 1: Set loading state and clear the previous error.
    // Matches the async lifecycle used by compileFirmware, uploadFirmware,
    // openSerial, etc.
    set({ aiLoading: true, aiError: null })

    try {
      // Step 2: Delegate to the preload bridge — AIService runs the full
      // pipeline in the Main process (PromptBuilder → AIClient → ResponseParser
      // → ResponseValidator → IProjectDocument).
      const result = await window.api.ai.generate(request)

      if (result.status === 'success') {
        // Step 3a: Store the returned document as the active project.
        // Atomic replacement — never mutates the previous instance (ADR-016).
        // A freshly generated project is never dirty and has no saved path.
        set({ currentProjectDoc: result.project, projectDirty: false, currentProjectPath: null })
      } else {
        // Step 3b: Surface the typed error. The code field allows the UI to
        // branch on error category without parsing the error string.
        set({ aiError: result.error })
      }
    } catch (err: unknown) {
      // Step 3c: IPC transport failure — AIService itself never throws, but
      // the preload bridge can fail if the Main process is unavailable.
      const message = err instanceof Error ? err.message : 'AI generation failed unexpectedly.'
      set({ aiError: message })
    } finally {
      // Step 4: Always restore the loading flag, regardless of outcome.
      set({ aiLoading: false })
    }
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
    set({
      currentProjectDoc: null,
      aiError: null,
      projectDirty: false,
      currentProjectPath: null
    })
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

    set({
      currentProjectDoc: projectDoc,
      // Clear any stale AI error from a previous generation attempt.
      aiError: null,
      // A freshly selected template is never dirty and has no saved path.
      projectDirty: false,
      currentProjectPath: null
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
  }
}))
