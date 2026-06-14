// Hook de "Los estandartes del header". Vive en un .js aparte (no en
// HeaderStandards.jsx) porque la regla react-refresh/only-export-components
// del repo exige que un módulo .jsx solo exporte componentes. Para la
// preferencia de reduced-motion se usa el hook CANÓNICO del proyecto
// (../hooks/useReducedMotionPref), que ya une SO + calma explícita; aquí no se
// duplica.
import { useEffect, useState } from 'react'

/**
 * useCondensedHeader — condensación del header al bajar, re-expansión al subir.
 *
 * PROHIBIDO animar height, y no se anima: el <header> (.as-header-shell)
 * mantiene SIEMPRE su alto de layout. La condensación es puro teatro de capas:
 *   (a) la capa de fondo .as-header-bg (fondo + borde inferior + sombra)
 *       hace translateY(-1rem) → el borde inferior SUBE y la barra se VE
 *       más baja; el contenido de página pasa por la franja liberada.
 *   (b) la fila .as-header-row hace translateY(-0.5rem) para re-centrarse
 *       en la altura visible, con cross-fade del wordmark (opacity 0).
 * Todo transform/opacity, 200ms ease-lift (clases en header-standards.css).
 * ⚠ El shell NUNCA lleva transform: un transform en el ancestro sticky
 * rompería position:sticky. Solo se transforman las capas internas.
 *
 * Dirección + histéresis: condensa bajando pasado `enterAt`; CUALQUIER gesto
 * de subida (>2px, filtra el jitter del trackpad) re-expande; por debajo de
 * `exitAt` siempre expandido. scrollY clampado a 0 (rubber-band de iOS).
 * reduced-motion: el booleano se sigue emitiendo; el CSS hace swap directo.
 *
 * @param {{ enterAt?: number, exitAt?: number }} [opts]
 * @returns {boolean} condensed — vuélcalo como data-condensed en el shell.
 */
export function useCondensedHeader({ enterAt = 96, exitAt = 24 } = {}) {
  const [condensed, setCondensed] = useState(false)
  useEffect(() => {
    let frame = 0
    let lastY = Math.max(0, window.scrollY)
    let current = false
    const update = () => {
      frame = 0
      const y = Math.max(0, window.scrollY)
      const dy = y - lastY
      if (Math.abs(dy) < 2) return
      lastY = y
      let next = current
      if (y <= exitAt) next = false
      else if (dy > 0 && y > enterAt) next = true
      else if (dy < 0) next = false
      if (next !== current) {
        current = next
        setCondensed(next)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enterAt, exitAt])
  return condensed
}
