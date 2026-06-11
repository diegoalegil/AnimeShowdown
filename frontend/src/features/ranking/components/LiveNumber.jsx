import { useEffect, useRef, useState } from 'react'

function formatLiveNumber(value) {
  if (!Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * Odómetro de la tabla viva: cuando el valor cambia en caliente (voto por
 * WS, refetch del ELO) el número rueda con rAF ~500ms ease-out cúbico y un
 * "+N"/"−N" decorativo flota hacia arriba y se desvanece. En el render
 * inicial y con prefers-reduced-motion el número aparece instantáneo.
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
    const duration = 500
    let start = 0
    let raf = requestAnimationFrame(function tick(now) {
      if (!start) {
        start = now
        setBurst({ delta: value - prev, marca: now })
      }
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setRoll(t < 1 ? prev + (value - prev) * eased : null)
      if (t < 1) raf = requestAnimationFrame(tick)
    })
    const timer = setTimeout(() => setBurst(null), 800)
    return () => {
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
