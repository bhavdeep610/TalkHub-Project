import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialize services before rendering
import signalRService from './services/signalRService'

// Ensure SignalR service is ready
const init = async () => {
  try {
    const token = localStorage.getItem('token')
    if (token) {
      await signalRService.initialize()
    }
  } catch (error) {
    console.error('Failed to initialize SignalR:', error)
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

init()
