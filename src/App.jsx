import React, { useState, useEffect } from 'react'
import KappaTracker from './KappaTracker'
import DebugPanel from './components/DebugPanel'
import LoadingScreen from './components/LoadingScreen'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check initial loading state
    const checkLoadingState = async () => {
      try {
        const state = await window.electron?.getLoadingState()
        if (state && !state.isLoading) {
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error checking loading state:', error)
      }
    }

    checkLoadingState()

    // Listen for scanner ready event
    const handleScannerReady = () => {
      console.log('Scanner service ready!')
      setIsLoading(false)
    }

    window.electron?.ipcRenderer.on('scanner-ready', handleScannerReady)

    return () => {
      window.electron?.ipcRenderer.removeListener('scanner-ready', handleScannerReady)
    }
  }, [])

  return (
    <>
      {isLoading && <LoadingScreen />}
      <KappaTracker />
      <DebugPanel />
    </>
  )
}

export default App
