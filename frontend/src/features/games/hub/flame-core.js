// flame-core.js — constantes PURAS de la llama de racha, compartidas entre el
// módulo completo (<StreakFlame> en /games) y el ascua compacta de la home
// (<HomeStreakEmber>). Sin React/DOM: solo los trazos de la llama, los niveles
// y los hitos. Mantener una sola fuente del ARTE de la llama (anti-duplicado).

export const MILESTONES = [3, 7, 14, 30]

// Silueta de la llama (lengua con muesca lateral) + núcleo interior.
export const OUTER =
  'M110 16C122 54 158 82 166 134C173 190 142 236 110 242C78 236 47 190 54 134C59 102 76 84 84 58C88 78 99 88 102 74C106 56 105 34 110 16Z'
export const CORE =
  'M110 104C121 128 138 142 138 174C138 202 125 220 110 224C95 220 82 202 82 174C82 148 99 130 110 104Z'

// Transform por nivel: escala anclada a la base de la llama (x=110, y=242).
export const TIER_TRANSFORM = {
  none: 'translate(37.4 133.1) scale(0.66 0.45)',
  ember: 'translate(37.4 133.1) scale(0.66 0.45)',
  flame: 'translate(8.8 19.36) scale(0.92)',
  double: undefined,
}

/** Nivel de llama según la racha: none / ember (1-2) / flame (3-6) / double (7+). */
export function tierOf(streak) {
  if (streak <= 0) return 'none'
  if (streak < 3) return 'ember'
  if (streak < 7) return 'flame'
  return 'double'
}
