/**
 * Nombres de CustomEvents de aplicación (window).
 *
 * Deliberadamente planos: los emisores (votar, cartas) no saben quién
 * escucha, y los oyentes (onboarding) no tocan React Query ni contextos —
 * cero acoplamiento entre features. El detail de cada evento se documenta
 * en el punto de emisión.
 */
export const VOTO_REGISTRADO_EVENT = 'as:voto-registrado'
export const SOBRE_ABIERTO_EVENT = 'as:sobre-abierto'

export function emitAppEvent(nombre, detail) {
  try {
    window.dispatchEvent(new CustomEvent(nombre, { detail }))
  } catch {
    /* entornos sin CustomEvent (SSR/tests viejos): el evento es opcional */
  }
}
