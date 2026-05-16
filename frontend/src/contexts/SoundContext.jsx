import { createContext, useContext, useEffect, useState } from 'react'
import * as sfx from '../lib/sounds'

const SoundContext = createContext(null)
const STORAGE_KEY = 'animeshowdown.muted'

export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(muted))
    } catch {
      // ignore
    }
  }, [muted])

  useEffect(() => {
    // Warm-up del AudioContext en la primera interacción del usuario para que el
    // primer sonido suene sin lag (las APIs de audio están suspended hasta gesture).
    const handler = () => {
      sfx.__warm?.()
    }
    document.addEventListener('pointerdown', handler, {
      once: true,
      passive: true,
    })
    document.addEventListener('keydown', handler, {
      once: true,
      passive: true,
    })
    return () => {
      document.removeEventListener('pointerdown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [])

  const play = (name) => {
    if (muted) return
    const fn = sfx[name]
    if (typeof fn === 'function') {
      try {
        fn()
      } catch {
        // ignore audio errors silently
      }
    }
  }

  const toggleMute = () => setMuted((m) => !m)

  return (
    <SoundContext.Provider value={{ muted, toggleMute, play }}>
      {children}
    </SoundContext.Provider>
  )
}

// react-refresh/only-export-components: separar el hook a un archivo
// useSound.js puro sería más limpio, pero el hook es de una línea y
// vive junto al provider por simetría con el resto de contexts.
// eslint-disable-next-line react-refresh/only-export-components
export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound debe usarse dentro de <SoundProvider>')
  return ctx
}
