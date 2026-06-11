/**
 * Lógica FLIP pura de la tabla viva del ranking.
 *
 * Cuando un voto del WS reordena la lista, cada fila se anima desde su
 * posición vieja (translateY(oldY − newY)) hasta la nueva. Estas funciones
 * calculan ese diff sin tocar React: el hook useFlipList las orquesta.
 *
 * Se usa offsetTop (no getBoundingClientRect): con content-visibility las
 * cajas offscreen pueden reportar rects de 0px, pero el layout containment
 * mantiene offsetTop estable.
 */

/**
 * Lee los offsetTop de los hijos directos de la lista marcados con
 * data-flip-key. Devuelve Map clave → offsetTop.
 */
export function snapshotOffsets(listEl) {
  const offsets = new Map()
  if (!listEl?.children) return offsets
  for (const el of listEl.children) {
    const key = el.dataset?.flipKey
    if (!key) continue
    const top = el.offsetTop
    if (typeof top !== 'number' || Number.isNaN(top)) continue
    offsets.set(key, top)
  }
  return offsets
}

/**
 * Diff de offsets antes/después. Solo devuelve filas presentes en ambos
 * snapshots, con desplazamiento real y con algún extremo del viaje dentro
 * de la ventana [viewportMin, viewportMax] (coordenadas offsetTop) — las
 * filas lejanas del viewport no merecen animación.
 *
 * deltaY = oldY − newY: el punto de partida del translateY que colapsa a 0.
 */
export function computeFlipMoves(
  prevOffsets,
  nextOffsets,
  { viewportMin = -Infinity, viewportMax = Infinity } = {},
) {
  const moves = []
  for (const [key, nextTop] of nextOffsets) {
    const prevTop = prevOffsets.get(key)
    if (prevTop == null || nextTop == null) continue
    const deltaY = prevTop - nextTop
    if (deltaY === 0) continue
    if (nextTop < viewportMin && prevTop < viewportMin) continue
    if (nextTop > viewportMax && prevTop > viewportMax) continue
    moves.push({ key, deltaY })
  }
  return moves
}

/**
 * Direcciones de movimiento por clave entre dos órdenes: 'up' si la fila
 * escaló posiciones, 'down' si cayó. Las filas nuevas o sin cambio no
 * aparecen en el resultado.
 */
export function computeRankShifts(prevOrder, nextOrder) {
  const prevIndex = new Map(prevOrder.map((key, index) => [key, index]))
  const shifts = new Map()
  nextOrder.forEach((key, index) => {
    const before = prevIndex.get(key)
    if (before == null || before === index) return
    shifts.set(key, index < before ? 'up' : 'down')
  })
  return shifts
}
