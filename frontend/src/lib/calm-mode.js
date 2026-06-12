/**
 * Modo calma — constantes y lectura compartidas entre useCalmMode (la
 * linterna), useReducedMotionPref (el gate único de los efectos JS) y el
 * boot inline de public/calm-boot.js. Una sola fuente de verdad para la
 * clave y el evento; cero React aquí.
 */

export const CALM_STORAGE_KEY = 'animeshowdown.calm'
export const CALM_EVENT = 'as:calm-change'

export function readStoredCalm() {
  try {
    return localStorage.getItem(CALM_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
