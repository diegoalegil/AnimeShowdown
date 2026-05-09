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
