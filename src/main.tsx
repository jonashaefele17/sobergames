import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App.tsx'
import { syncClock } from './lib/clock'

// Uhr mit dem Server abgleichen, damit Countdown und Stoppuhr auf allen Geräten gleich laufen
void syncClock()
window.setInterval(() => void syncClock(), 10 * 60 * 1000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
