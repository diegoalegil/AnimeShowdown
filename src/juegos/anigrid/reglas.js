// AniGrid: las reglas, sin React. Un personaje secreto, seis intentos y, por
// cada intento, cinco fichas que lo comparan con el secreto: inicial del
// nombre, serie, género, año de estreno de la serie y popularidad. Todo recibe
// el generador de azar al final para que los tests sean deterministas.
import { elegirUno, enteroEntre } from '../comun/azar.js'
import { conPopularidad, serieDe } from '../comun/cartas.js'
import { normalizar } from '../../lib/catalog.js'

export const MAX_INTENTOS = 6

/** Dos personajes son «igual de populares» si sus puestos distan ≤ 5 % del ranking. */
export const TOLERANCIA_POPULARIDAD = 0.05

/** Las columnas del tablero, en orden, con su etiqueta y su kanji decorativo. */
export const COLUMNAS = [
  { clave: 'inicial', etiqueta: 'Inicial', kanji: '初' },
  { clave: 'serie', etiqueta: 'Serie', kanji: '作' },
  { clave: 'genero', etiqueta: 'Género', kanji: '性' },
  { clave: 'anio', etiqueta: 'Año', kanji: '年' },
  { clave: 'popularidad', etiqueta: 'Popularidad', kanji: '人' },
]

/** Primera letra del nombre latino, sin tildes y en mayúscula ('' si no hay). */
export function inicialDe(carta) {
  return normalizar(carta.nombre).charAt(0).toUpperCase()
}

/** Solo las letras del nombre, en orden (sin espacios ni signos), tal como se escriben. */
export function letrasDe(carta) {
  return [...String(carta.nombre ?? '')].filter((c) => /\p{L}/u.test(c))
}

/**
 * Ranking de popularidad: puesto de cada personaje (0 = el más popular) y
 * cuántos puestos de diferencia cuentan aún como «igual». Se construye una
 * vez por partida sobre los personajes con favoritos.
 */
export function crearRanking(lista = conPopularidad()) {
  const ordenados = [...lista].sort((a, b) => b.favs - a.favs || a.id.localeCompare(b.id))
  const puesto = new Map(ordenados.map((c, i) => [c.id, i]))
  return { puesto, tolerancia: Math.ceil(ordenados.length * TOLERANCIA_POPULARIDAD) }
}

/** 'igual' | 'distinta' */
export const compararInicial = (intento, secreto) => (inicialDe(intento) === inicialDe(secreto) ? 'igual' : 'distinta')

/** 'igual' | 'distinta' */
export const compararSerie = (intento, secreto) => (intento.animeId === secreto.animeId ? 'igual' : 'distinta')

/** 'igual' | 'distinto' | 'desconocido' (si a alguno le falta el dato). */
export function compararGenero(intento, secreto) {
  if (!intento.genero || !secreto.genero) return 'desconocido'
  return intento.genero === secreto.genero ? 'igual' : 'distinto'
}

/** Año de estreno de la serie de una carta, o undefined. */
export const anioDe = (carta) => serieDe(carta)?.anio

/** 'igual' | 'anterior' | 'posterior' (el secreto respecto al intento) | 'desconocido'. */
export function compararAnio(intento, secreto) {
  const a = anioDe(intento)
  const b = anioDe(secreto)
  if (!Number.isInteger(a) || !Number.isInteger(b)) return 'desconocido'
  if (a === b) return 'igual'
  return b < a ? 'anterior' : 'posterior'
}

/** 'igual' (puestos cercanos) | 'mas' | 'menos' (el secreto es más/menos popular) | 'desconocido'. */
export function compararPopularidad(intento, secreto, ranking) {
  const a = ranking.puesto.get(intento.id)
  const b = ranking.puesto.get(secreto.id)
  if (a === undefined || b === undefined) return 'desconocido'
  if (Math.abs(a - b) <= ranking.tolerancia) return 'igual'
  return b < a ? 'mas' : 'menos'
}

/** Un intento comparado con el secreto: la carta, las cinco fichas y si acertó. */
export function compararIntento(intento, secreto, ranking) {
  return {
    carta: intento,
    acierto: intento.id === secreto.id,
    inicial: compararInicial(intento, secreto),
    serie: compararSerie(intento, secreto),
    genero: compararGenero(intento, secreto),
    anio: compararAnio(intento, secreto),
    popularidad: compararPopularidad(intento, secreto, ranking),
  }
}

/**
 * Tono visual de una ficha: 'oro' si coincide, 'ceniza' si no. La
 * popularidad «igual» se pinta en cian: no es un dato exacto, es cercanía.
 */
export function tonoDe(clave, valor) {
  if (valor !== 'igual') return 'ceniza'
  return clave === 'popularidad' ? 'cian' : 'oro'
}

/**
 * Nueva partida: un secreto entre los personajes con popularidad (fuera de
 * `excluir`, los ya jugados en esta sesión) y el tablero vacío.
 */
export function nuevaPartida(rng = Math.random, { lista = conPopularidad(), excluir } = {}) {
  const candidatos = excluir?.size ? lista.filter((c) => !excluir.has(c.id)) : lista
  const secreto = elegirUno(candidatos.length ? candidatos : lista, rng)
  return { secreto, ranking: crearRanking(lista), intentos: [], pista: null, fin: null }
}

/** Intentos gastados: los enviados más uno si se pidió la pista. */
export const intentosUsados = (partida) => partida.intentos.length + (partida.pista ? 1 : 0)

export const intentosRestantes = (partida) => MAX_INTENTOS - intentosUsados(partida)

/** true si ya se probó ese personaje. */
export const yaProbado = (partida, carta) => partida.intentos.some((i) => i.carta.id === carta.id)

/**
 * Envía un intento. Devuelve la partida nueva (la misma si ya terminó o el
 * personaje se repite). `fin` pasa a 'victoria' al acertar y a 'derrota' al
 * agotar los seis intentos.
 */
export function intentar(partida, carta) {
  if (partida.fin || yaProbado(partida, carta) || intentosRestantes(partida) <= 0) return partida
  const comparacion = compararIntento(carta, partida.secreto, partida.ranking)
  const intentos = [...partida.intentos, comparacion]
  const siguiente = { ...partida, intentos }
  const fin = comparacion.acierto ? 'victoria' : intentosRestantes(siguiente) <= 0 ? 'derrota' : null
  return { ...siguiente, fin }
}

/** La pista se puede pedir una vez, si queda más de un intento y el nombre tiene al menos dos letras. */
export function puedePedirPista(partida) {
  return !partida.fin && !partida.pista && intentosRestantes(partida) > 1 && letrasDe(partida.secreto).length >= 2
}

/**
 * Pide la pista: una letra del nombre que no sea la primera, a cambio de un
 * intento. Devuelve la partida nueva (la misma si no se puede).
 * pista = { posicion (1 = primera letra), letra, total }.
 */
export function pedirPista(partida, rng = Math.random) {
  if (!puedePedirPista(partida)) return partida
  const letras = letrasDe(partida.secreto)
  const indice = enteroEntre(1, letras.length - 1, rng)
  return { ...partida, pista: { posicion: indice + 1, letra: letras[indice], total: letras.length } }
}

/** Puntos de una victoria: 60 al primer intento, 10 al sexto; 0 si se perdió. */
export function puntosDe(partida) {
  if (partida.fin !== 'victoria') return 0
  return (MAX_INTENTOS - intentosUsados(partida) + 1) * 10
}

const TEXTOS = {
  inicial: { igual: 'misma inicial', distinta: 'otra inicial' },
  serie: { igual: 'misma serie', distinta: 'otra serie' },
  genero: { igual: 'mismo género', distinto: 'otro género', desconocido: 'género desconocido' },
  anio: {
    igual: 'mismo año de estreno',
    anterior: 'el secreto es de una serie anterior',
    posterior: 'el secreto es de una serie posterior',
    desconocido: 'año desconocido',
  },
  popularidad: {
    igual: 'popularidad parecida',
    mas: 'el secreto es más popular',
    menos: 'el secreto es menos popular',
    desconocido: 'popularidad desconocida',
  },
}

/** Qué dice una ficha, en palabras (para el lector de pantalla y el title). */
export const textoFicha = (clave, valor) => TEXTOS[clave]?.[valor] ?? ''

/** Una frase con todo el intento, para anunciarlo: «Intento 2, Levi: misma inicial, …». */
export function describirIntento(comparacion, numero) {
  if (comparacion.acierto) return `Intento ${numero}, ${comparacion.carta.nombre}: ¡es el personaje secreto!`
  const partes = COLUMNAS.map(({ clave }) => textoFicha(clave, comparacion[clave]))
  return `Intento ${numero}, ${comparacion.carta.nombre}: ${partes.join(', ')}.`
}
