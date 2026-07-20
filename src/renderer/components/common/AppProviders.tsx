import React, { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

interface AppProvidersProps {
  children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  const { initializeHardware, disposeHardware } = useAppStore()

  useEffect(() => {
    initializeHardware()
    return () => {
      disposeHardware()
    }
  }, [initializeHardware, disposeHardware])

  return <HashRouter>{children}</HashRouter>
}
