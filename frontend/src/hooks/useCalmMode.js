import { useCallback, useEffect, useState } from 'react'
import { CALM_EVENT, CALM_STORAGE_KEY, readStoredCalm } from '../lib/calm-mode'

/**
 * useCalmMode — modo calma explícito (la linterna del dojo).
 *
 * Hace DESCUBRIBLE lo que prefers-reduced-motion ya hacía invisible:
 * un toggle en el header que apaga atmósferas canvas, parallax y montajes
 * 3D enganchándose a los MISMOS gates que ya consultan reduced-motion.
 *
 * Modelo de estado (dos fuentes, una unión):
 *   - calmUser   → preferencia explícita del usuario. Persiste en
 *                  localStorage['animeshowdown.calm'] (misma convención que
 *                  'animeshowdown.muted') y se espeja en html.as-calm.
 *   - osReduced  → prefers-reduced-motion del SO, suscripción viva.
 *   - calm       → osReduced || calmUser. Es lo ÚNICO que consultan los gates.
 *
 * Por qué html.as-calm guarda SOLO calmUser: el SO ya lo cubren las media
 * queries nativas de index.css; duplicarlo en la clase crearía dos fuentes
 * de verdad que pueden divergir (p. ej. el usuario cambia el ajuste del SO
 * con la pestaña abierta).
 *
 * El SO es SUELO, no default: con osReduced=true la linterna queda en brasa
 * y toggle() es no-op (+ anuncio aria-live explicando por qué). Si soporte
 * pide permitir el override, es UNA rama en toggle() — decisión reversible.
 *
 * Sincronización entre instancias (header desktop + panel móvil + paleta)
 * por CustomEvent en window: sin context nuevo, sin re-render del árbol
 * entero (la lección del SoundProvider).
 *
 * El boot sin flash vive en public/calm-boot.js (clásico en <head>; la CSP
 * del repo no permite inline scripts) — pone html.as-calm antes del paint.
 */

const PULSE_ATTR = 'data-calm-pulse'
const PULSE_MS = 260

function useOsReduced() {
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

export function useCalmMode() {
  const osReduced = useOsReduced()
  const [calmUser, setCalmUser] = useState(readStoredCalm)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const onChange = (e) => setCalmUser(e.detail.calm)
    window.addEventListener(CALM_EVENT, onChange)
    return () => window.removeEventListener(CALM_EVENT, onChange)
  }, [])

  // Espejo en html.as-calm — el boot ya la puso antes del paint;
  // este efecto solo cubre los cambios en caliente.
  useEffect(() => {
    document.documentElement.classList.toggle('as-calm', calmUser)
  }, [calmUser])

  const toggle = useCallback(() => {
    if (osReduced) {
      // El SO es suelo: no hay nada que encender. Solo explicamos.
      setAnnouncement(
        'Tu sistema ya solicita menos movimiento; la linterna permanece en brasa.',
      )
      return
    }
    const next = !calmUser
    try {
      localStorage.setItem(CALM_STORAGE_KEY, String(next))
    } catch {
      // storage bloqueado: el modo funciona en sesión, sin persistir
    }
    window.dispatchEvent(new CustomEvent(CALM_EVENT, { detail: { calm: next } }))
    setAnnouncement(
      next
        ? 'Modo calma activado: animaciones y efectos reducidos.'
        : 'Modo calma desactivado: la linterna vuelve a arder.',
    )
    if (next) {
      // Confirmación: el header respira un instante (solo opacity).
      const html = document.documentElement
      html.setAttribute(PULSE_ATTR, '')
      window.setTimeout(() => html.removeAttribute(PULSE_ATTR), PULSE_MS)
    }
  }, [calmUser, osReduced])

  return { calmUser, osReduced, calm: osReduced || calmUser, toggle, announcement }
}
