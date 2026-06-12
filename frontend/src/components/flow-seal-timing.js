/**
 * Escalera de tiempos compartida de los lacres (FlowSeal) — módulo hermano
 * para no romper fast-refresh y poder testearla sin montar React.
 *
 *   0–550 ms  asentado del lacre (scale 1.45 → 0.965 → 1 + opacity)
 *   430–1030  evento del variante (brillo / separación / fractura)
 *   560–1100  señales secundarias (hairline, filo eléctrico, carta asomando)
 */

export const FLOWSEAL_EASE = [0.16, 1, 0.3, 1] // = --ease-lift

export const FLOWSEAL_TIMING = {
  press: { duration: 0.55, times: [0, 0.62, 1] },
  event: { delay: 0.43, duration: 0.6 },
  secondary: { delay: 0.56, duration: 0.35 },
}
