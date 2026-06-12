/**
 * verdict-timing.js — "La balanza de tinta" (VoteVerdict)
 *
 * Constantes de fase de la coreografía del veredicto post-voto.
 * ÚNICA fuente de verdad temporal: VoteVerdict.jsx las consume en runtime
 * (y las inyecta a verdict.css vía custom props --vv-d-* / --vv-ms-*),
 * y los tests de coreografía importan de aquí.
 *
 * Ubicación sugerida: src/features/votar/verdict-timing.js
 */

/** t0 → t+600ms: ambas aguadas avanzan con UN solo progress (ease-brush). */
export const WASH_MS = 600

/** t+600ms: nace la hairline dorada en el punto de encuentro. */
export const HAIRLINE_AT_MS = 600
export const HAIRLINE_MS = 120

/** t+720ms: el lado ganador respira UNA vez (scale 1 → 1.012 → 1). */
export const BREATH_AT_MS = 720
export const BREATH_MS = 250

/** t+800ms: el sello 票 cae sobre tu lado (overshoot de hanko). */
export const STAMP_AT_MS = 800
export const STAMP_MS = 350

/** t+1000ms: el sangrado del sello aflora cuando el hanko asienta. */
export const STAMP_BLEED_AT_MS = 1000
export const STAMP_BLEED_MS = 240

/** t+720ms: UN destello cian de 150ms sobre la hairline — SOLO underdog. */
export const FLASH_AT_MS = 720
export const FLASH_MS = 150

/** Fin de la pieza completa. */
export const VERDICT_TOTAL_MS = STAMP_BLEED_AT_MS + STAMP_BLEED_MS // 1240

/** Suelo visual de la aguada corta. La CIFRA siempre dice la verdad. */
export const MIN_VISUAL_PCT = 6

/**
 * Umbral de underdog: % ESPERADO (prior, p. ej. derivado de ELO) del lado
 * que acabó ganando. ≤35 ⇒ la grada rugió ⇒ destello cian.
 */
export const UNDERDOG_MAX_EXPECTED_PCT = 35

/** Un tick de odómetro cada ~8 puntos del lado líder. */
export const ODOMETER_TICK_EVERY_PCT = 8

/** Curvas de la casa (espejo de index.css, en formato framer-motion). */
export const EASE_BRUSH = [0.65, 0.05, 0.36, 1]
export const EASE_STAMP = [0.34, 1.56, 0.64, 1]
export const EASE_LIFT = [0.16, 1, 0.3, 1]

/**
 * Delays RELATIVOS al settle (t+600, fin del avance de aguadas) que
 * consume verdict.css. El componente los pasa como --vv-d-*.
 */
export const SETTLE_DELAYS_MS = Object.freeze({
  hairline: HAIRLINE_AT_MS - HAIRLINE_AT_MS, // 0
  flash: FLASH_AT_MS - HAIRLINE_AT_MS, //       120
  breath: BREATH_AT_MS - HAIRLINE_AT_MS, //     120
  stamp: STAMP_AT_MS - HAIRLINE_AT_MS, //       200
  bleed: STAMP_BLEED_AT_MS - HAIRLINE_AT_MS, // 400
})

/**
 * Split VISUAL de la aguada A (0–100), clamp al suelo de legibilidad:
 * 99/1 se pinta 94/6 pero el odómetro dice 99/1.
 * @param {number} pctA Porcentaje REAL del lado A (0–100).
 * @returns {number} Porcentaje visual de A.
 */
export function visualSplit(pctA) {
  return Math.min(100 - MIN_VISUAL_PCT, Math.max(MIN_VISUAL_PCT, pctA))
}

/**
 * ¿Rugió la grada? true si el lado ganador era el underdog.
 * @param {number|null|undefined} expectedWinnerPct % esperado (prior) del
 *   lado que acabó ganando. Si el producto no aporta el dato, omitir:
 *   sin dato no hay destello — nunca inventamos la señal.
 * @returns {boolean}
 */
export function isUnderdogWin(expectedWinnerPct) {
  return (
    typeof expectedWinnerPct === 'number' &&
    expectedWinnerPct <= UNDERDOG_MAX_EXPECTED_PCT
  )
}
