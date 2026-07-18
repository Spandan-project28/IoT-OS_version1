import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  board: {
    getConnected: () => ipcRenderer.invoke('board:getConnected'),
    onWatch: (callback: (event: unknown, data: unknown) => void) => {
      ipcRenderer.on('board:watch', callback)
      return () => ipcRenderer.removeListener('board:watch', callback)
    }
  },
  upload: {
    start: (projectPath: string, boardType: string, port: string) =>
      ipcRenderer.invoke('upload:start', { projectPath, boardType, port }),
    cancel: () => ipcRenderer.invoke('upload:cancel'),
    onProgress: (callback: (event: unknown, data: unknown) => void) => {
      ipcRenderer.on('upload:progress', callback)
      return () => ipcRenderer.removeListener('upload:progress', callback)
    }
  },
  serial: {
    start: (port: string, baudRate: number) =>
      ipcRenderer.invoke('serial:start', { port, baudRate }),
    stop: () => ipcRenderer.invoke('serial:stop'),
    clear: () => ipcRenderer.invoke('serial:clear'),
    onData: (callback: (event: unknown, data: string) => void) => {
      ipcRenderer.on('serial:data', callback)
      return () => ipcRenderer.removeListener('serial:data', callback)
    }
  },
  ai: {
    generate: (prompt: string, boardType: string) =>
      ipcRenderer.invoke('ai:generate', { prompt, boardType })
  },
  project: {
    new: (name: string, boardType: string) =>
      ipcRenderer.invoke('project:new', { name, boardType }),
    open: (path: string) => ipcRenderer.invoke('project:open', path),
    save: (path: string, code: string) => ipcRenderer.invoke('project:save', { path, code })
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
