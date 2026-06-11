/**
 * Única fuente de verdad del motion language en JS (Kessen §1.4). Las
 * mismas curvas viven como tokens CSS en index.css (--ease-lift /
 * --ease-brush) para animaciones de hoja de estilos; aquí están para
 * framer-motion y WAAPI — la curva lift llegó a estar copiada como
 * literal en 7+ archivos.
 *
 *  - EASE_LIFT: entradas y hovers premium (decelera con asentado suave).
 *  - EASE_BRUSH: trazo de pincel del kanji (arranca cargado, suelta seco).
 *  - DUR (segundos, unidad de framer): fast = micro-feedback ·
 *    base = transiciones de UI · brush = trazos de tinta ·
 *    ceremony = coreografías (dollys, ceremonias).
 */
export const EASE_LIFT = [0.16, 1, 0.3, 1]
export const EASE_BRUSH = [0.65, 0.05, 0.36, 1]

export const DUR = {
  fast: 0.22,
  base: 0.3,
  brush: 0.45,
  ceremony: 0.9,
}
