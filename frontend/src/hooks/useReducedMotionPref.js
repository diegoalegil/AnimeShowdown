import { useEffect, useState } from 'react'

/**
 * Preferencia de reduced-motion como hook ÚNICO del proyecto para el código
 * que no usa framer (canvas, rAF caseros, Web Audio): el kill-switch CSS de
 * index.css no aplica a JS, y la versión casera estaba duplicada en 5+
 * archivos. Para componentes framer sigue valiendo su useReducedMotion.
 *
 * Lazy initializer (computa en el primer render, sin setState-en-effect)
 * + suscripción viva al change del media query.
 */
export function useReducedMotionPref() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
  return reduced
}
