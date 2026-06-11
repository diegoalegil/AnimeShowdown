/**
 * Constantes y helpers del Altar de Mi Top 5, en módulo hermano: los
 * consumen Top5Altar y los orígenes del vuelo (sugerencias/buscador vía la
 * página) sin arrastrar exports no-componente al JSX
 * (react-refresh/only-export-components).
 */

/** Evento del vuelo FLIP: anuncia slug + rect de origen del chip clicado. */
export const TOP5_VUELO_EVENT = 'animeshowdown:top5-vuelo'

/** Anuncia el origen del vuelo. Llamar desde el chip/resultado clicado —
 *  antes o después de asignar el slot: el altar concilia por slug. */
export function lanzarVueloTop5(slug, originEl) {
  if (typeof window === 'undefined' || !originEl?.getBoundingClientRect) return
  window.dispatchEvent(
    new CustomEvent(TOP5_VUELO_EVENT, {
      detail: { slug, originRect: originEl.getBoundingClientRect() },
    }),
  )
}

/** Numerales kanji de rango grabados en cada peana. */
export const KANJI_RANGO = ['一', '二', '三', '四', '五']

/**
 * Composiciones del escalonado. left/bottom posicionan el ancla del
 * pedestal; z/y/ry son la transform 3D; fog es la niebla por opacity
 * (aplicada en el HIJO, nunca en el nodo preserve-3d — regla WebKit).
 */
export const COMPOSICIONES = {
  ceremonial: [
    { left: '50%', bottom: 34, z: 95, y: -26, ry: 0, fog: 1 },
    { left: '28%', bottom: 58, z: 0, y: 0, ry: 0, fog: 0.96 },
    { left: '72%', bottom: 58, z: 0, y: 0, ry: 0, fog: 0.96 },
    { left: '9%', bottom: 80, z: -115, y: 0, ry: 0, fog: 0.72 },
    { left: '91%', bottom: 80, z: -115, y: 0, ry: 0, fog: 0.72 },
  ],
  escalera: [
    { left: '13%', bottom: 30, z: 95, y: 0, ry: 0, fog: 1 },
    { left: '31.5%', bottom: 48, z: 35, y: 0, ry: 0, fog: 0.95 },
    { left: '50%', bottom: 64, z: -25, y: 0, ry: 0, fog: 0.85 },
    { left: '68.5%', bottom: 78, z: -85, y: 0, ry: 0, fog: 0.72 },
    { left: '87%', bottom: 90, z: -140, y: 0, ry: 0, fog: 0.6 },
  ],
  abanico: [
    { left: '50%', bottom: 34, z: 95, y: -26, ry: 0, fog: 1 },
    { left: '27%', bottom: 62, z: 5, y: 0, ry: 16, fog: 0.95 },
    { left: '73%', bottom: 62, z: 5, y: 0, ry: -16, fog: 0.95 },
    { left: '7%', bottom: 84, z: -100, y: 0, ry: 26, fog: 0.72 },
    { left: '93%', bottom: 84, z: -100, y: 0, ry: -26, fog: 0.72 },
  ],
}
