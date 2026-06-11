import { useEffect, useRef } from 'react'
import './cartas.css'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function clamp01(valor) {
  return Math.min(1, Math.max(0, valor))
}

// Retardo antes de marcar la presión en táctil (delaysContentTouches) y
// desplazamiento a partir del cual el gesto se considera scroll.
const PRESS_DELAY_MS = 90
const SCROLL_SLOP_PX = 8

/**
 * Envuelve una carta del álbum con tilt 3D al puntero y capas de foil
 * (glare especular + lámina por rareza). Mismo motor que PersonajeCardHolo:
 * custom props --mx/--my (0..1) y --active (0/1) actualizadas vía
 * requestAnimationFrame, sin re-renders de React. El CSS vive en cartas.css
 * (.as-card-tilt / .as-card-foil).
 *
 * - Solo inclina con puntero fino (hover:hover + pointer:fine). En táctil
 *   queda el feedback de presión: scale + pulso breve del foil, retrasado
 *   ~90ms (patrón delaysContentTouches de iOS) para que las cartas no
 *   parpadeen al hacer scroll por el álbum.
 * - Con prefers-reduced-motion no monta listeners y el CSS oculta las capas.
 * - Las capas son decorativas: aria-hidden, pointer-events: none y z-index
 *   por debajo de las acciones del tile (botón de descarga en z-10).
 * - sheen: barrido de luz idle periódico (Salón Legendario).
 */
function TiltCard({ children, foil = 'ssr', sheen = false, className = '' }) {
  const rootRef = useRef(null)
  const rafRef = useRef(0)
  const pendingRef = useRef(null)
  const esEspecial = foil === 'especial'

  useEffect(() => {
    const el = rootRef.current
    if (!el || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Sin puntero fino no hay tilt que seguir: presión = scale en CSS
    // (.is-pressed) + el foil pulsa centrado mientras dura el toque. La
    // presión se marca tras PRESS_DELAY_MS; si antes el dedo se levanta o
    // se desplaza más de SCROLL_SLOP_PX (scroll), se cancela sin pintar.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let pressTimer = 0
      let downX = 0
      let downY = 0

      const press = () => {
        pressTimer = 0
        el.classList.add('is-pressed')
        el.style.setProperty('--active', '1')
      }
      const release = () => {
        if (pressTimer) {
          clearTimeout(pressTimer)
          pressTimer = 0
        }
        el.classList.remove('is-pressed')
        el.style.setProperty('--active', '0')
      }
      const onDown = (e) => {
        downX = e.clientX
        downY = e.clientY
        release()
        pressTimer = window.setTimeout(press, PRESS_DELAY_MS)
      }
      const onMove = (e) => {
        if (!pressTimer && !el.classList.contains('is-pressed')) return
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > SCROLL_SLOP_PX) {
          release()
        }
      }
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', release)
      el.addEventListener('pointercancel', release)
      return () => {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', release)
        el.removeEventListener('pointercancel', release)
        if (pressTimer) clearTimeout(pressTimer)
      }
    }

    // pointermove llega varias veces por frame: se coalesce con rAF y solo
    // la última posición toca el style antes del siguiente paint.
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      pendingRef.current = {
        x: clamp01((e.clientX - rect.left) / (rect.width || 1)),
        y: clamp01((e.clientY - rect.top) / (rect.height || 1)),
      }
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const { x, y } = pendingRef.current
        el.style.setProperty('--mx', x.toFixed(3))
        el.style.setProperty('--my', y.toFixed(3))
        el.style.setProperty('--active', '1')
        el.classList.add('is-active')
      })
    }
    const onLeave = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      el.classList.remove('is-active')
      el.style.setProperty('--mx', '0.5')
      el.style.setProperty('--my', '0.5')
      el.style.setProperty('--active', '0')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointercancel', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointercancel', onLeave)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={cx('as-card-tilt', esEspecial && 'as-card-tilt--especial', className)}
      style={{ '--mx': '0.5', '--my': '0.5', '--active': '0' }}
    >
      {children}
      <div
        className={cx('as-card-foil', esEspecial ? 'as-card-foil--especial' : 'as-card-foil--ssr')}
        aria-hidden="true"
      >
        {esEspecial && (
          <>
            <span className="as-card-foil__sparkle" />
            <span className="as-card-foil__sparkle" />
            <span className="as-card-foil__sparkle" />
            <span className="as-card-foil__sparkle" />
          </>
        )}
        {sheen && <span className="as-card-foil__sheen" />}
      </div>
    </div>
  )
}

export default TiltCard
