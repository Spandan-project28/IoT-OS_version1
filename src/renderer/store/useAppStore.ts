/**
 * useAppStore
 *
 * The single centralized Zustand store for IoTOS AI.
 *
 * Architectural rules:
 * - This is the ONLY global store. Do NOT create a second hardware store.
 * - All window.api.hardware.* calls are made exclusively from this store.
 *   React components MUST NOT call window.api directly.
 * - Components consume Zustand state through selectors only.
 * - The hardware slice communicates with the preload bridge through typed actions.
 * - The push-event unsubscribe handle is a module-level private variable —
 *   it is not application state and must never enter the Zustand state graph.
 *
 * Hardware state lifecycle:
 *   initializeHardware()  → subscribe to push events + load initial state
 *   loadHardwareState()   → one-time read of current snapshot (no I/O trigger)
 *   refreshHardware()     → force out-of-cycle scan + update store
 *   disposeHardware()     → unsubscribe push events + reset initialization flag
 *
 * Typical usage pattern:
 *   Call initializeHardware() once at the top-level component (AppProviders).
 *   Call disposeHardware() in the corresponding cleanup.
 *   Components read hardware state via useAppStore selectors.
 */

import { create } from 'zustand'
import type { IHardwareState } from '@shared/types/hardware'

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
}

// ---------------------------------------------------------------------------
// Private module-level runtime handle
//
// The unsubscribe function returned by window.api.hardware.onStateChanged().
// This is a runtime resource, not application state — it must never enter
// the Zustand store. Stored at module scope so initializeHardware() and
// disposeHardware() share the same reference across calls.
// ---------------------------------------------------------------------------

let _hardwareUnsubscribe: (() => void) | null = null

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
  }
}))
