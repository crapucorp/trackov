import React, { useState, useEffect } from 'react'

function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Initializing scanner service...')
  const [timeElapsed, setTimeElapsed] = useState(0)

  useEffect(() => {
    // Get initial loading state
    const getInitialState = async () => {
      try {
        const state = await window.electron?.getLoadingState()
        if (state) {
          setProgress(state.progress || 0)
          setMessage(state.message || 'Loading...')
        }
      } catch (error) {
        console.error('Error getting initial loading state:', error)
      }
    }

    getInitialState()

    // Listen for loading progress from Electron
    const handleLoadingProgress = (event, data) => {
      setProgress(data.progress || 0)
      setMessage(data.message || 'Loading...')
    }

    window.electron?.ipcRenderer.on('scanner-loading-progress', handleLoadingProgress)

    // Timer for elapsed time
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
    }, 1000)

    return () => {
      window.electron?.ipcRenderer.removeListener('scanner-loading-progress', handleLoadingProgress)
      clearInterval(timer)
    }
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(10, 15, 20, 0.98)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
      color: '#ecfeff'
    }}>
      {/* Logo or Title */}
      <div style={{
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '40px',
        color: '#22d3ee',
        textShadow: '0 0 10px rgba(34, 211, 238, 0.5)',
        letterSpacing: '2px'
      }}>
        TARKOV TRACKER
      </div>

      {/* Loading Animation */}
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(6, 182, 212, 0.2)',
        borderTop: '4px solid #06b6d4',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '30px'
      }}></div>

      {/* Progress Bar Container */}
      <div style={{
        width: '400px',
        height: '8px',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '20px',
        border: '1px solid rgba(6, 182, 212, 0.3)'
      }}>
        {/* Progress Bar Fill */}
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: '#06b6d4',
          transition: 'width 0.3s ease',
          boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)'
        }}></div>
      </div>

      {/* Progress Text */}
      <div style={{
        fontSize: '14px',
        color: '#94a3b8',
        marginBottom: '10px',
        textAlign: 'center'
      }}>
        {message}
      </div>

      {/* Progress Percentage */}
      <div style={{
        fontSize: '16px',
        color: '#22d3ee',
        fontWeight: 'bold',
        marginBottom: '10px'
      }}>
        {progress}%
      </div>

      {/* Elapsed Time */}
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        marginTop: '10px'
      }}>
        Elapsed: {timeElapsed}s
      </div>

      {/* Hint */}
      {timeElapsed > 10 && (
        <div style={{
          marginTop: '30px',
          fontSize: '12px',
          color: '#64748b',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          First-time initialization may take up to 60 seconds<br />
          Please be patient...
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoadingScreen
