import React from 'react'
import { AppProviders } from './components/common/AppProviders'
import { AppRouter } from './components/common/AppRouter'

function App(): React.JSX.Element {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}

export default App
