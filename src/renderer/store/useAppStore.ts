import { create } from 'zustand'

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

export interface AppState {
  // Pure UI State
  sidebarCollapsed: boolean
  currentTheme: 'dark' | 'light'

  // Future Business State Placeholders
  boardStatus: IBoardStatus
  currentProject: IProject | null
  uploadStatus: IUploadStatus
  aiStatus: IAIStatus
  serialStatus: ISerialStatus

  // UI Actions
  toggleSidebar: () => void
  setTheme: (theme: 'dark' | 'light') => void
}

export const useAppStore = create<AppState>((set) => ({
  // UI State
  sidebarCollapsed: false,
  currentTheme: 'dark',

  // Placeholders
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

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ currentTheme: theme })
}))
