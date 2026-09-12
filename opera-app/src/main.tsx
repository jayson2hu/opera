import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyFontSizePreference, applyThemePreference, readPreferences } from './lib/preferences'

// Apply saved visual preferences before the first React paint to avoid a flash.
const initialPreferences = readPreferences()
applyFontSizePreference(initialPreferences.fontSize)
applyThemePreference(initialPreferences.theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
