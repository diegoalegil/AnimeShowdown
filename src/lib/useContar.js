import { useLayoutEffect, useRef } from 'react'
import { movimientoReducido } from './motion.js'

/** Curva de la cuenta: rápida al principio y posándose al final. */
export const frenada = (p) => 1 - (1 - p) ** 3

/** Valor que muestra la cuenta en el instante `t` (ms desde el inicio). */
export function valorContado(t, fin, duracion) {
  if (t <= 0) return 0
  if (t >= duracion) return fin
  return Math.round(frenada(t / duracion) * fin)
}

/**
 * Cuenta ascendente, una sola vez al montar: el número sube desde 0 hasta
 * el valor que pinta React. El elemento de la ref debe llevar ese valor en
 * `data-valor` y como texto; la animación solo cambia el texto (sin estado
 * de React ni re-renders) y, si el valor cambia mientras cuenta, termina en
 * el nuevo. Con movimiento reducido no cuenta.
 */
export function useContar({ duracion = 900, retardo = 0 } = {}) {
  const ref = useRef(null)

  // Antes de pintar: el primer frame ya muestra 0, sin destello del valor final.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || movimientoReducido() || !Number(el.dataset.valor)) return undefined
    const escribir = (texto) => {
      if (el.firstChild) el.firstChild.nodeValue = texto
    }
    escribir('0')
    let frame = 0
    let inicio = null
    const paso = (ahora) => {
      inicio ??= ahora + retardo
      const t = ahora - inicio
      escribir(String(valorContado(t, Number(el.dataset.valor), duracion)))
      frame = t < duracion ? requestAnimationFrame(paso) : 0
    }
    frame = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(frame)
      escribir(el.dataset.valor)
    }
  }, [duracion, retardo])

  return ref
}
