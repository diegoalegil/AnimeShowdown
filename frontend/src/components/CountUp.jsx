import { useEffect, useState } from 'react'

/**
 * Anima un contador de 0 a `target` con easing easeOutCubic.
 * Antes usaba framer-motion useInView para arrancar al entrar en viewport, pero
 * en producción una de las 4 instancias quedaba pegada en 0 (probable race con
 * IntersectionObserver y refs en React 19). Ahora arranca on-mount, simple y
 * predictible — la sección padre tiene su propio whileInView y para cuando el
 * user scrollea aquí los counters ya tienen valor estable.
 */
function CountUp({ target, duration = 1.6, suffix = '', instant = false }) {
  const [value, setValue] = useState(0)
  // Cuando target no es animable (no número o 0) renderizamos el valor
  // directamente sin pasar por setState dentro del effect — el lint de
  // react-compiler marca el setState síncrono al inicio de un effect
  // como cascading render. Render derivado evita el problema.
  // instant (prefers-reduced-motion / calma): la cifra aparece asentada
  // sin rAF — misma vía de render derivado que el caso inanimable.
  const inanimable = typeof target !== 'number' || target === 0 || instant
  const display = inanimable ? (target || 0) : value

  useEffect(() => {
    if (inanimable) return
    let raf
    const start = performance.now()
    const step = (now) => {
      const elapsed = (now - start) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, inanimable])

  return (
    <span>
      {display}
      {suffix}
    </span>
  )
}

export default CountUp
