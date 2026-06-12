import { useEffect, useState } from 'react'
import { CALM_EVENT, readStoredCalm } from '../lib/calm-mode'

/**
 * Preferencia de "menos movimiento" como hook ÚNICO del proyecto para el
 * código que no usa framer (canvas, rAF caseros, Web Audio): el kill-switch
 * CSS de index.css no aplica a JS, y la versión casera estaba duplicada en
 * 5+ archivos. Para componentes framer sigue valiendo su useReducedMotion
 * (App lo alinea vía <MotionConfig reducedMotion>).
 *
 * Desde el modo calma (la linterna del dojo) devuelve la UNIÓN
 * prefers-reduced-motion del SO || calma explícita del usuario — los
 * consumidores existentes (atmósferas, sismógrafo, brackets, ondas) se
 * calman gratis sin tocarlos.
 *
 * Lazy initializer (computa en el primer render, sin setState-en-effect)
 * + suscripción viva al change del media query y al evento de la linterna.
 */
export function useReducedMotionPref() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return readStoredCalm()
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches || readStoredCalm()
    )
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const recompute = () => setReduced(mq.matches || readStoredCalm())
    mq.addEventListener?.('change', recompute)
    window.addEventListener(CALM_EVENT, recompute)
    return () => {
      mq.removeEventListener?.('change', recompute)
      window.removeEventListener(CALM_EVENT, recompute)
    }
  }, [])
  return reduced
}
