import { createContext, useContext, useEffect, useState } from 'react'
import * as sfx from '../lib/sounds'

function despertarAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    // El contexto se queda en sounds.js — esto solo lo despierta vía gesture
    sfx.__despertarCtx?.(ctx)
  } catch {
    // ignore
  }
}

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

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound debe usarse dentro de <SoundProvider>')
  return ctx
}
