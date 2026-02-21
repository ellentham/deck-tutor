import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedCacheWithSampleData } from './lib/scryfallApi'

// Pre-seed cache with sample cards (best-effort; app works without it via bundled fallback)
seedCacheWithSampleData().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
