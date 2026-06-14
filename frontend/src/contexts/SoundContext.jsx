import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Sentry } from '../lib/sentry'
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

  // play/toggleMute/warm y el objeto value se
  // creaban nuevos en cada render del provider → toda la app re-renderizaba
  // y los useEffect con `play` en deps re-corrían (case BadgeUnlockListener,
  // VotarPage, etc.). useCallback + useMemo estabiliza identidades.
  const play = useCallback(
    (name) => {
      if (muted) return
      const fn = sfx[name]
      if (typeof fn !== 'function') return
      // Nota de rendimiento: los playXxx son async ahora
      // (esperan resume() del AudioContext). El caller no necesita
      // await; agarramos la Promise para silenciar rechazos y evitar
      // unhandled-rejection en consola.
      try {
        const result = fn()
        if (result && typeof result.then === 'function') {
          result.catch(() => { /* audio rejection silenced */ })
        }
      } catch (err) {
        // catch{} síncrono: solo errores reales del generador
        // (no rechazos async, que van al .catch() de arriba).
        Sentry.captureException(err, { level: 'warning' })
      }
    },
    [muted],
  )

  // Warm-up explícito para componentes que sepan ANTES del click que va
  // a haber sonido — caso de /votar, donde el hover sobre una card
  // anticipa el click. Asegura que el AudioContext esté en estado
  // running cuando llegue el click, evitando el lag del await resume().
  const warm = useCallback(() => {
    try {
      const result = sfx.__warm?.()
      if (result && typeof result.then === 'function') {
        result.catch(() => { /* ignore */ })
      }
    } catch {
      /* ignore */
    }
  }, [])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  const value = useMemo(
    () => ({ muted, toggleMute, play, warm }),
    [muted, toggleMute, play, warm],
  )

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
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

// Variante tolerante para componentes reutilizables que pueden montarse fuera
// del SoundProvider (p.ej. PressSheet en un harness de test o un futuro
// contexto sin audio): el sonido es cosmético, así que sin provider devuelve
// un play() no-op en vez de tirar. NUNCA lanza.
const NOOP_SOUND = { play: () => {}, muted: true, toggleMute: () => {}, warm: () => {} }
// eslint-disable-next-line react-refresh/only-export-components
export function useSoundOptional() {
  return useContext(SoundContext) ?? NOOP_SOUND
}
