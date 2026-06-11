import { useLayoutEffect, useRef } from 'react'
import {
  computeFlipMoves,
  computeRankShifts,
  snapshotOffsets,
} from './live-flip'

const FLIP_DURATION_MS = 420
const FLASH_DURATION_MS = 600
const VIEWPORT_MARGIN_PX = 200
// Un voto mueve pocas filas; un cambio de filtro o un refetch completo las
// mueve casi todas. Por encima de este umbral saltamos la animación: el
// reorden masivo instantáneo lee mejor y no quema main thread.
const MAX_ANIMATED_SHIFTS = 24

/**
 * FLIP manual para listas de ranking que se reordenan en vivo (sin layoutId
 * de framer: con 100 filas el coste de medirlas todas en cada render no
 * compensa). Tras cada commit se snapshotean los offsetTop por
 * data-flip-key; al cambiar el orden, cada fila que se movió y está cerca
 * del viewport se anima translateY(oldY − newY → 0) vía WAAPI, y su overlay
 * [data-flip-flash] parpadea en success/danger según subió o bajó.
 *
 * @param listRef ref del <ol>/<ul> cuyos hijos llevan data-flip-key
 * @param order array memoizado de claves en el orden actual
 */
export function useFlipList(listRef, order) {
  const prevOffsetsRef = useRef(null)
  const prevOrderRef = useRef(null)

  useLayoutEffect(() => {
    const listEl = listRef.current
    const prevOffsets = prevOffsetsRef.current
    const prevOrder = prevOrderRef.current
    const nextOffsets = snapshotOffsets(listEl)
    prevOffsetsRef.current = nextOffsets
    prevOrderRef.current = order
    if (!listEl || !prevOffsets || !prevOrder) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const shifts = computeRankShifts(prevOrder, order)
    if (shifts.size === 0 || shifts.size > MAX_ANIMATED_SHIFTS) return

    // Ventana del viewport traducida al espacio offsetTop de las filas.
    const rect = listEl.getBoundingClientRect()
    const base = listEl.offsetTop - rect.top
    const moves = computeFlipMoves(prevOffsets, nextOffsets, {
      viewportMin: base - VIEWPORT_MARGIN_PX,
      viewportMax: base + window.innerHeight + VIEWPORT_MARGIN_PX,
    })
    if (moves.length === 0) return

    const nodes = new Map()
    for (const el of listEl.children) {
      if (el.dataset?.flipKey) nodes.set(el.dataset.flipKey, el)
    }
    const ease =
      getComputedStyle(listEl).getPropertyValue('--ease-lift').trim() ||
      'ease-out'
    for (const { key, deltaY } of moves) {
      const node = nodes.get(key)
      if (!node || typeof node.animate !== 'function') continue
      node.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }],
        { duration: FLIP_DURATION_MS, easing: ease },
      )
      const dir = shifts.get(key)
      const flashEl = dir
        ? node.querySelector(`[data-flip-flash="${dir}"]`)
        : null
      flashEl?.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
        { duration: FLASH_DURATION_MS, easing: 'ease-out' },
      )
    }
  }, [listRef, order])
}
