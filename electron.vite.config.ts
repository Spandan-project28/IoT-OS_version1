import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    // Monaco's editor.worker.js (imported via `?worker`) is an ES module
    // (monaco-editor's esm/ distribution) — it must be bundled as an ES
    // module worker, not Vite's default IIFE format, for Slice 29's
    // locally-bundled Monaco integration to work offline.
    worker: {
      format: 'es'
    },
    plugins: [react(), tailwindcss()]
  }
})
