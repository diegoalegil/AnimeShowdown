import { useEffect, useRef, useState } from 'react'
import {
  MAX_ANIMATED_CHANGES_PER_CYCLE,
  trackLiveChange,
} from '../live-burst-gate'

function formatLiveNumber(value) {
  if (!Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * Odómetro de la tabla viva: cuando el valor cambia en caliente (voto por
 * WS, refetch del ELO) el número rueda con rAF ~500ms ease-out cúbico y un
 * "+N"/"−N" decorativo flota hacia arriba y se desvanece. En el render
 * inicial, con prefers-reduced-motion y en los cambios masivos (refetch que
 * mueve media tabla; ver live-burst-gate) el número aparece instantáneo.
 */
function LiveNumber({ value, className = '' }) {
  // roll = valor intermedio del odómetro; null fuera de animación.
  const [roll, setRoll] = useState(null)
  const [burst, setBurst] = useState(null)
  const prevRef = useRef(value)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value
    if (!Number.isFinite(value) || !Number.isFinite(prev) || value === prev) {
      // Sin animación nueva no puede quedar vivo el estado de una anterior
      // cancelada a medias: un roll obsoleto congelaría el display en un
      // valor intermedio (roll ?? value) y un burst sin timer no se iría.
      setRoll(null)
      setBurst(null)
      return undefined
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setRoll(null)
      setBurst(null)
      return undefined
    }
    // La decisión de animar espera un microtask: para entonces el gate ya
    // contó cuántos LiveNumber cambiaron en este mismo ciclo.
    const cycle = trackLiveChange()
    let raf = 0
    let timer = 0
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (cycle.count > MAX_ANIMATED_CHANGES_PER_CYCLE) {
        // Cambio masivo: el número salta directo al valor final (que ya
        // está pintado) y suelta el estado de cualquier roll anterior.
        setRoll(null)
        setBurst(null)
        return
      }
      const duration = 500
      let start = 0
      raf = requestAnimationFrame(function tick(now) {
        if (!start) {
          start = now
          setBurst({ delta: value - prev, marca: now })
        }
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setRoll(t < 1 ? prev + (value - prev) * eased : null)
        if (t < 1) raf = requestAnimationFrame(tick)
      })
      timer = setTimeout(() => setBurst(null), 800)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [value])

  return (
    <span className={`relative inline-block tabular-nums ${className}`}>
      {formatLiveNumber(roll ?? value)}
      {burst && (
        <span
          key={burst.marca}
          aria-hidden="true"
          className={`live-burst pointer-events-none absolute -right-1 -top-2 font-mono text-[10px] font-extrabold ${
            burst.delta > 0 ? 'text-success' : 'text-danger'
          }`}
        >
          {burst.delta > 0 ? '+' : '−'}
          {formatLiveNumber(Math.abs(burst.delta))}
        </span>
      )}
    </span>
  )
}

export default LiveNumber
