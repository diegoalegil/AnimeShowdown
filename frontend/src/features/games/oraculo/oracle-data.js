/* Helpers puros del santuario del oráculo (módulo hermano: el .jsx solo
   exporta componentes, fast-refresh). */

/**
 * Cadencia del aura: la confianza se SIENTE como respiración, no se lee
 * como barra. 0 → ciclo 4s (lejos), 0.6 → 2.5s (cerca), 1 → 1.5s (al
 * borde del veredicto). Mapeo lineal: dur = 4 − 2.5·confidence.
 * @param {number} confidence 0–1 normalizada.
 * @returns {string} duración CSS, p. ej. "2.50s".
 */
export function auraCycleFromConfidence(confidence) {
  const c = Math.min(1, Math.max(0, confidence))
  return `${(4 - 2.5 * c).toFixed(2)}s`
}
