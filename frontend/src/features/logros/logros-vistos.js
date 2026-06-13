/**
 * Registro LOCAL de logros ya "estampados" en la sala de trofeos.
 *
 * El backend no tiene flag de no-visto: la ceremonia de estampado en vivo
 * se decide en cliente — un logro desbloqueado que aún no esté en este set
 * se estampa con ceremonia al entrar a /logros, y al terminar la cola se
 * marca aquí. Mismo espíritu que el snapshot del expediente (/mi-ranking).
 */

const KEY = 'animeshowdown.logros.vistos.v1'

/** @returns {Set<string>} codigos ya estampados en este navegador */
export function leerLogrosVistos() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const lista = JSON.parse(raw)
    return new Set(Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Añade codigos al registro (idempotente). */
export function marcarLogrosVistos(codigos) {
  try {
    const actual = leerLogrosVistos()
    for (const c of codigos) actual.add(c)
    localStorage.setItem(KEY, JSON.stringify([...actual]))
  } catch {
    // storage bloqueado: la ceremonia simplemente se repetirá otro día
  }
}
