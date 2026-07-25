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
 * - All window.api.template.* calls are NOT required — templates are pure
 *   static renderer-side data with no IPC involvement.
 * - Components consume Zustand state through selectors only.
 * - The hardware slice communicates with the preload bridge through typed actions.
 * - The upload slice communicates with the preload bridge through typed actions.
 * - The serial slice communicates with the preload bridge through typed actions.
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
 *   selectTemplate(t)  → stores the chosen ITemplateDefinition in selectedTemplate
 *   clearTemplate()    → resets selectedTemplate to null
 *
 * Typical usage pattern:
 *   Call initializeHardware() once at the top-level component (AppProviders).
 *   Call disposeHardware() in the corresponding cleanup.
 *   Call initializeSerial() once at the top-level component (AppProviders).
 *   Call disposeSerial() in the corresponding cleanup.
 *   Components read hardware state via useAppStore selectors.
 *   Components trigger uploads via useAppStore upload actions.
 *   Components interact with serial via useAppStore serial actions.
 *   Components read selectedTemplate and call selectTemplate/clearTemplate.
 */

import { create } from 'zustand'
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

// ---------------------------------------------------------------------------
// Phase 1 placeholder types (retained — consumed by existing UI components)
// ---------------------------------------------------------------------------

export interface IBoardStatus {
  name: string | null
  port: string | null
  type: string | null
  isConnected: boolean
}

export interface IProject {
  name: string | null
  path: string | null
  code: string | null
}

export interface IUploadStatus {
  isUploading: boolean
  progress: number
  error: string | null
}

export interface IAIStatus {
  isGenerating: boolean
  error: string | null
}

export interface ISerialStatus {
  isConnected: boolean
  port: string | null
  baudRate: number
  logs: string[]
}

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
  // Phase 1 Business State Placeholders
  //
  // Retained for existing UI consumers. These will be superseded by real
  // implementations in later phases (Upload, Serial, AI slices).
  // -------------------------------------------------------------------------

  boardStatus: IBoardStatus
  currentProject: IProject | null
  uploadStatus: IUploadStatus
  aiStatus: IAIStatus
  serialStatus: ISerialStatus

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
  //
  // Naming is intentionally distinct from the Phase 1 `uploadStatus`
  // placeholder above, which is retained for existing UI consumers.
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
  // Template State (Phase 5, Slice 20)
  //
  // Pure renderer-side state. Templates are static data — no IPC, no Main
  // process involvement, no async operations. The selected template is read
  // by the Editor page to populate the firmware source and info panel.
  // -------------------------------------------------------------------------

  /**
   * The template the user has chosen from the Template Gallery.
   *
   * Null on application startup and after clearTemplate() is called.
   * Set to the full ITemplateDefinition by selectTemplate().
   *
   * The Editor page reads this to:
   *   - Populate the firmware code panel with selectedTemplate.firmware.
   *   - Pass firmware to the TopBar firmwareSource prop (activates Upload button).
   *   - Display template metadata in the Firmware Assistant panel.
   */
  selectedTemplate: ITemplateDefinition | null

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
   * 1. Guards against duplicate subscriptions (serialInitialized flag via module var).
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
  // Template Actions (Phase 5, Slice 20)
  // -------------------------------------------------------------------------

  /**
   * Stores the template the user has selected from the Template Gallery.
   *
   * Called by the Projects page when the user clicks a TemplateCard.
   * The Editor page reads selectedTemplate after navigation to display
   * the template firmware and metadata.
   *
   * Calling this action again with a different template replaces the
   * current selection — no intermediate reset is required.
   *
   * Pure synchronous action. No IPC. No side effects.
   */
  selectTemplate: (template: ITemplateDefinition) => void

  /**
   * Clears the active template selection, resetting selectedTemplate to null.
   *
   * The Editor page falls back to its empty state when selectedTemplate is null.
   * Call this when the user explicitly starts a blank project.
   *
   * Pure synchronous action. No IPC. No side effects.
   */
  clearTemplate: () => void
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
  // Phase 1 Placeholders
  // -------------------------------------------------------------------------

  boardStatus: {
    name: null,
    port: null,
    type: null,
    isConnected: false
  },
  currentProject: null,
  uploadStatus: {
    isUploading: false,
    progress: 0,
    error: null
  },
  aiStatus: {
    isGenerating: false,
    error: null
  },
  serialStatus: {
    isConnected: false,
    port: null,
    baudRate: 9600,
    logs: []
  },

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
  // Template State initial values (Phase 5, Slice 20)
  // -------------------------------------------------------------------------

  selectedTemplate: null,

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
  // Template Actions (Phase 5, Slice 20)
  // -------------------------------------------------------------------------

  selectTemplate: (template: ITemplateDefinition) => {
    set({ selectedTemplate: template })
  },

  clearTemplate: () => {
    set({ selectedTemplate: null })
  }
}))
