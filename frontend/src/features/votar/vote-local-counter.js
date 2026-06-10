// Contador local de votos (logueado o no). El e2e usa la clave de
// localStorage como ground-truth del flujo de votar — no renombrar.

export const STORAGE_VOTES_COUNT = 'animeshowdown.votos_count'
export const VOTES_COUNT_EVENT = 'animeshowdown:votes-count'

export function incrementarContadorLocalVotos() {
  try {
    const current = Number(localStorage.getItem(STORAGE_VOTES_COUNT) || '0')
    const next = Number.isFinite(current) ? current + 1 : 1
    localStorage.setItem(STORAGE_VOTES_COUNT, String(next))
    window.dispatchEvent(new CustomEvent(VOTES_COUNT_EVENT, { detail: next }))
  } catch {
    // localStorage puede fallar en privacy mode; votar no debe depender de esto.
  }
}
