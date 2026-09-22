import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <main className="wrap py-16">
      <h1 className="pincel text-5xl">AnimeShowdown</h1>
    </main>
  </StrictMode>,
)

import('./fuentes-jp.css')
