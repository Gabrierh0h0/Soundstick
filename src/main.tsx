import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/vt323/latin-400.css'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import '@fontsource/special-elite/latin-400.css'
import '@fontsource/share-tech-mono/latin-400.css'
import '@fontsource/orbitron/latin-900.css'
import '@fontsource/rubik-glitch/latin-400.css'
import '@fontsource/oxanium/latin-400.css'
import '@fontsource/oxanium/latin-700.css'
import '@fontsource/archivo-black/latin-400.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
