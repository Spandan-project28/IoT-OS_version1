import React, { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

interface AppProvidersProps {
  children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  const { initializeHardware, disposeHardware, initializeSerial, disposeSerial } = useAppStore()

  useEffect(() => {
    initializeHardware()
    initializeSerial()
    return () => {
      disposeHardware()
      disposeSerial()
    }
  }, [initializeHardware, disposeHardware, initializeSerial, disposeSerial])

  return <HashRouter>{children}</HashRouter>
}
