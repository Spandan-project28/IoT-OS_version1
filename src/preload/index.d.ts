import { ElectronAPI } from '@electron-toolkit/preload'

export interface IApi {
  board: {
    getConnected: () => Promise<unknown[]>
    onWatch: (callback: (event: unknown, data: unknown) => void) => () => void
  }
  upload: {
    start: (projectPath: string, boardType: string, port: string) => Promise<unknown>
    cancel: () => Promise<unknown>
    onProgress: (callback: (event: unknown, data: unknown) => void) => () => void
  }
  serial: {
    start: (port: string, baudRate: number) => Promise<unknown>
    stop: () => Promise<unknown>
    clear: () => Promise<unknown>
    onData: (callback: (event: unknown, data: string) => void) => () => void
  }
  ai: {
    generate: (
      prompt: string,
      boardType: string
    ) => Promise<{
      code: string
      explanation: string
      components: string[]
      wiring: string
    }>
  }
  project: {
    new: (name: string, boardType: string) => Promise<unknown>
    open: (path: string) => Promise<unknown>
    save: (path: string, code: string) => Promise<unknown>
  }
  settings: {
    get: () => Promise<unknown>
    set: (settings: unknown) => Promise<unknown>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
