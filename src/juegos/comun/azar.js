// Azar para los juegos: generadores con o sin semilla y las operaciones de
// siempre (barajar, elegir sin repetir, elegir de series distintas). Todo
// recibe el generador como último argumento, así que las partidas se pueden
// reproducir en los tests y los juegos «del día» salen iguales para todos.

/** Hash FNV-1a de 32 bits de un texto: una semilla estable a partir de «silueta:2026-03-01». */
export function semillaDe(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Generador de números en [0, 1). Sin semilla es Math.random; con ella
 * (número o texto), una secuencia determinista (mulberry32).
 */
export function crearAzar(semilla) {
  if (semilla === undefined || semilla === null) return Math.random
  let a = (typeof semilla === 'string' ? semillaDe(semilla) : semilla) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Entero en [0, max): nunca se sale aunque el generador devuelva 1. */
export const entero = (max, rng = Math.random) => Math.min(Math.floor(rng() * max), max - 1)

/** Entero entre `min` y `max`, ambos incluidos. */
export const enteroEntre = (min, max, rng = Math.random) => min + entero(max - min + 1, rng)

/** Un elemento al azar de la lista (undefined si está vacía). */
export const elegirUno = (lista, rng = Math.random) => (lista.length ? lista[entero(lista.length, rng)] : undefined)

/** Copia barajada de la lista (Fisher-Yates); la original no cambia. */
export function barajar(lista, rng = Math.random) {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = entero(i + 1, rng)
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/**
 * `n` elementos distintos de la lista, en orden aleatorio. Si la lista es
 * más corta, devuelve todos barajados.
 */
export function elegirVarios(lista, n, rng = Math.random) {
  if (n >= lista.length) return barajar(lista, rng)
  const copia = [...lista]
  const elegidos = []
  for (let i = 0; i < n; i++) {
    const j = i + entero(copia.length - i, rng)
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    elegidos.push(copia[i])
  }
  return elegidos
}

/**
 * `n` cartas de series distintas entre sí (cada una de una serie que no
 * repite ninguna otra), en orden aleatorio. `clave` dice qué es «la serie»
 * de un elemento (por defecto, animeId). Si no hay series suficientes,
 * devuelve una carta por cada serie que haya.
 */
export function elegirDeSeriesDistintas(cartas, n, rng = Math.random, { clave = (c) => c.animeId, excluir } = {}) {
  const porSerie = new Map()
  for (const carta of barajar(cartas, rng)) {
    const serie = clave(carta)
    if (excluir?.has(serie) || porSerie.has(serie)) continue
    porSerie.set(serie, carta)
  }
  return elegirVarios([...porSerie.values()], n, rng)
}

/** Las mismas opciones en otro orden, con la correcta entre ellas: para las preguntas de elegir. */
export function mezclarOpciones(correcta, distractores, rng = Math.random) {
  return barajar([correcta, ...distractores], rng)
}
