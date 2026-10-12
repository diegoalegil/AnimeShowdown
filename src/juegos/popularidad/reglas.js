// ¿Quién es más popular?: las reglas, sin pantalla. Dos cartas en una
// balanza: la referencia enseña sus favoritos en AniList y el jugador dice
// si la retadora tiene más o menos. Si acierta, la retadora pasa a ser la
// referencia del siguiente duelo. Una ronda son cinco duelos seguidos; un
// fallo la termina.
import { elegirUno, entero } from '../comun/azar.js'
import { conPopularidad, popularidad } from '../comun/cartas.js'

/** Duelos que hay que acertar seguidos para ganar la ronda (y el sobre). */
export const DUELOS_POR_RONDA = 5

/** La retadora nunca es obvia ni imposible: su proporción con la referencia va de 1,08 a 2,5. */
export const PROPORCION_MIN = 1.08
export const PROPORCION_MAX = 2.5

/** Inclinación del brazo (grados): la mínima con proporción 1,08 y la máxima con 2,5. */
export const INCLINACION_MIN = 3
export const INCLINACION_MAX = 6

/** Clave propia para el récord de aciertos seguidos (ver leerMejorRacha). */
export const CLAVE_RECORD = 'animeshowdown:juegos:popularidad:v1'

/** Proporción entre dos cartas: siempre ≥ 1 (la mayor entre la menor). */
export function proporcion(a, b) {
  const x = popularidad(a)
  const y = popularidad(b)
  if (x <= 0 || y <= 0) return Infinity
  return Math.max(x, y) / Math.min(x, y)
}

/** true si `candidata` puede retar a `referencia`: otra carta, otro nombre, favoritos distintos y proporción en banda. */
export function esRetadoraValida(referencia, candidata) {
  if (candidata.id === referencia.id) return false
  if (candidata.nombre === referencia.nombre) return false // homónimos de otra serie
  if (popularidad(candidata) === popularidad(referencia)) return false
  const p = proporcion(referencia, candidata)
  return p >= PROPORCION_MIN && p <= PROPORCION_MAX
}

/**
 * Una retadora al azar para `referencia`, fuera de los ids ya vistos en la
 * ronda. Si ninguna cumple la banda, la más cercana con favoritos distintos
 * (nunca un empate). Devuelve undefined solo si la lista no da para más.
 */
export function elegirRetadora(referencia, lista, rng = Math.random, { excluir } = {}) {
  const libres = lista.filter((c) => !excluir?.has(c.id) && c.id !== referencia.id && c.nombre !== referencia.nombre)
  const enBanda = libres.filter((c) => esRetadoraValida(referencia, c))
  if (enBanda.length) return elegirUno(enBanda, rng)
  const distintas = libres.filter((c) => popularidad(c) !== popularidad(referencia))
  if (!distintas.length) return undefined
  return distintas.reduce((mejor, c) => (proporcion(referencia, c) < proporcion(referencia, mejor) ? c : mejor))
}

/**
 * Empieza una ronda: una referencia al azar y su retadora.
 *   { referencia, retadora, duelo: 1, aciertos: 0, vistos: Set<id> }
 */
export function nuevaRonda(rng = Math.random, lista = conPopularidad()) {
  const referencia = lista[entero(lista.length, rng)]
  const vistos = new Set([referencia.id])
  const retadora = elegirRetadora(referencia, lista, rng, { excluir: vistos })
  if (retadora) vistos.add(retadora.id)
  return { referencia, retadora, duelo: 1, aciertos: 0, vistos }
}

/** La respuesta correcta de un duelo: 'mas' si la retadora tiene más favoritos, 'menos' si no. */
export const respuestaCorrecta = ({ referencia, retadora }) =>
  popularidad(retadora) > popularidad(referencia) ? 'mas' : 'menos'

/**
 * Resuelve un duelo con la elección del jugador ('mas' | 'menos').
 *   { acierto, correcta, ganada, terminada }
 * `ganada` solo si era el último duelo y se acertó; `terminada` si la ronda acaba aquí.
 */
export function resolver(ronda, eleccion) {
  const correcta = respuestaCorrecta(ronda)
  const acierto = eleccion === correcta
  const ganada = acierto && ronda.duelo >= DUELOS_POR_RONDA
  return { acierto, correcta, ganada, terminada: !acierto || ganada }
}

/**
 * El siguiente duelo tras un acierto: la retadora pasa a ser la referencia y
 * llega otra retadora que no se haya visto en la ronda.
 */
export function siguienteDuelo(ronda, rng = Math.random, lista = conPopularidad()) {
  const referencia = ronda.retadora
  const vistos = new Set(ronda.vistos)
  const retadora = elegirRetadora(referencia, lista, rng, { excluir: vistos }) ?? elegirRetadora(referencia, lista, rng)
  if (retadora) vistos.add(retadora.id)
  return { referencia, retadora, duelo: ronda.duelo + 1, aciertos: ronda.aciertos + 1, vistos }
}

/**
 * Cuánto se inclina el brazo al revelar: negativo si pesa más la referencia
 * (izquierda), positivo si pesa más la retadora (derecha). Crece con la
 * proporción entre ambas, de INCLINACION_MIN a INCLINACION_MAX grados.
 */
export function inclinacion({ referencia, retadora }) {
  const p = Math.min(Math.max(proporcion(referencia, retadora), PROPORCION_MIN), PROPORCION_MAX)
  const t = (Math.log(p) - Math.log(PROPORCION_MIN)) / (Math.log(PROPORCION_MAX) - Math.log(PROPORCION_MIN))
  const grados = INCLINACION_MIN + t * (INCLINACION_MAX - INCLINACION_MIN)
  return respuestaCorrecta({ referencia, retadora }) === 'mas' ? grados : -grados
}

/** Favoritos con separador de miles a la española: 12 345 → «12.345». */
export const formatearFavs = (n) => new Intl.NumberFormat('es-ES').format(n)

/** Valor del contador que sube de 0 a `objetivo` cuando ha pasado la fracción `p` (0..1) del tiempo, frenando al final. */
export function valorContador(objetivo, p) {
  const t = Math.min(Math.max(p, 0), 1)
  return Math.round(objetivo * (1 - (1 - t) ** 3))
}

/** Pesas que se pintan en la fila de la racha (las demás se resumen en «+N»). */
export const PESAS_VISIBLES = 10

/** Cómo pintar la racha: pesas numeradas y cuántas quedan sin pintar. */
export function pesasDeRacha(racha, visibles = PESAS_VISIBLES) {
  const n = Math.max(0, Math.floor(racha))
  const pintadas = Math.min(n, visibles)
  // Las últimas, para que la pesa nueva siempre aparezca al final de la fila.
  const pesas = Array.from({ length: pintadas }, (_, i) => n - pintadas + i + 1)
  return { pesas, ocultas: n - pintadas }
}

/** El récord de aciertos seguidos guardado en este navegador (0 si no hay o no se puede leer). */
export function leerMejorRacha(storage) {
  try {
    const crudo = storage?.getItem(CLAVE_RECORD)
    if (!crudo) return 0
    const datos = JSON.parse(crudo)
    const n = Number(datos?.mejorRacha)
    return Number.isInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** Guarda `racha` como récord si supera al guardado; devuelve el récord vigente. */
export function guardarMejorRacha(storage, racha) {
  const actual = leerMejorRacha(storage)
  if (!(racha > actual)) return actual
  try {
    storage?.setItem(CLAVE_RECORD, JSON.stringify({ mejorRacha: racha }))
  } catch {
    // Sin almacenamiento (modo privado, cuota…): el récord vive solo en la sesión.
  }
  return racha
}
