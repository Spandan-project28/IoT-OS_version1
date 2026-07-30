import React, { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

interface AppProvidersProps {
  children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  const {
    initializeHardware,
    disposeHardware,
    initializeSerial,
    disposeSerial,
    loadRecentProjects,
    initializeProjectSync,
    disposeProjectSync
  } = useAppStore()

  useEffect(() => {
    initializeHardware()
    initializeSerial()
    // Phase 7, Slice 31: one-time load — recentProjects is intentionally
    // never refreshed again after this (see useAppStore.ts's doc comment).
    void loadRecentProjects()
    // Phase 7, Slice 32: subscribes to project:saved so autosave (and any
    // other saveType) is reflected in the store regardless of which action
    // triggered the write.
    initializeProjectSync()
    return () => {
      disposeHardware()
      disposeSerial()
      disposeProjectSync()
    }
  }, [
    initializeHardware,
    disposeHardware,
    initializeSerial,
    disposeSerial,
    loadRecentProjects,
    initializeProjectSync,
    disposeProjectSync
  ])

  // ---------------------------------------------------------------------------
  // Save keyboard shortcuts (Phase 7, Slice 30)
  //
  // Global, document-level listener, not scoped to any single page — matches
  // the app-wide side-effect pattern already used above for hardware/serial.
  // Reads state via useAppStore.getState() rather than a reactive hook
  // subscription so this effect never needs to be torn down and re-attached
  // as currentProjectDoc changes on every Monaco keystroke.
  //
  // Ctrl+S / Cmd+S       -> saveProject()   (no-op if no project is active)
  // Ctrl+Shift+S / Cmd+Shift+S -> saveAsProject()
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isSaveCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (!isSaveCombo) return

      const { currentProjectDoc, saveProject, saveAsProject } = useAppStore.getState()
      if (!currentProjectDoc) return

      event.preventDefault()

      if (event.shiftKey) {
        void saveAsProject()
      } else {
        void saveProject()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return <HashRouter>{children}</HashRouter>
}
