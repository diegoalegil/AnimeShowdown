/**
 * Hooks compartidos de la Ficha del Combatiente.
 * Módulo .js hermano (sin exports de componentes → react-refresh feliz).
 * React 19 + Compiler: setState solo dentro de callbacks (rAF / observer /
 * listener); refs solo se leen/escriben dentro de effects.
 */
import { useEffect, useRef, useState } from 'react'

/** Sigue prefers-reduced-motion en vivo (asientos directos, cifras instantáneas). */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    const raf = requestAnimationFrame(apply)
    mq.addEventListener('change', apply)
    return () => {
      cancelAnimationFrame(raf)
      mq.removeEventListener('change', apply)
    }
  }, [])
  return reduced
}

/**
 * Revela UNA vez al entrar al viewport (IntersectionObserver, se desconecta
 * solo; en entornos sin IO — jsdom — revela de inmediato).
 * @param {number} threshold proporción visible que dispara la revelación
 * @returns {[import('react').RefObject, boolean]}
 */
export function useRevealOnce(threshold) {
  const ref = useRef(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || revealed) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      const raf = requestAnimationFrame(() => setRevealed(true))
      return () => cancelAnimationFrame(raf)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[entries.length - 1].isIntersecting) {
          setRevealed(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [revealed, threshold])
  return [ref, revealed]
}
