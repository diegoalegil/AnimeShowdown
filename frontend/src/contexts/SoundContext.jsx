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
    // Warm-up del AudioContext en cada interacción del usuario. Sin once:true
    // porque si la pestaña pierde foco el ctx puede volver a suspended y nos
    // interesa re-resumirlo en el siguiente gesture (resume() es no-op si ya
    // está running, así que no penaliza). También al recuperar foco.
    const handler = () => {
      sfx.__warm?.()
    }
    document.addEventListener('pointerdown', handler, { passive: true })
    document.addEventListener('keydown', handler, { passive: true })
    window.addEventListener('focus', handler)
    return () => {
      document.removeEventListener('pointerdown', handler)
      document.removeEventListener('keydown', handler)
      window.removeEventListener('focus', handler)
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

  // Warm-up explícito para componentes que sepan ANTES del click que va
  // a haber sonido — caso de /votar, donde el hover sobre una card
  // anticipa el click. Asegura que el AudioContext esté en estado
  // running cuando llegue el click, evitando el lag del await resume().
  const warm = () => {
    try {
      sfx.__warm?.()
    } catch {
      /* ignore */
    }
  }

  const toggleMute = () => setMuted((m) => !m)

  return (
    <SoundContext.Provider value={{ muted, toggleMute, play, warm }}>
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
