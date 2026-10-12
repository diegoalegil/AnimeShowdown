// Atajos sobre el catálogo para los juegos: solo personajes (las cartas
// especiales son variantes y no cuentan como respuesta), agrupados por
// serie y con lo que cada juego suele pedir («una serie con al menos cuatro
// personajes», «un personaje de otra serie»…).
import { catalogo, esEspecial } from '../../lib/catalog.js'
import { elegirDeSeriesDistintas, elegirUno, elegirVarios } from './azar.js'

/** Todos los personajes (sin especiales), en orden de catálogo. */
export const PERSONAJES = catalogo.personajes

/** Todas las series con algún personaje, ordenadas por título. */
export const SERIES = catalogo.animes

/** Personajes de una serie (sin sus cartas especiales). */
export function personajesDeSerie(animeId) {
  return catalogo.cartasDeAnime(animeId).filter((c) => !esEspecial(c))
}

/** Series con al menos `n` personajes. */
export const seriesConAlMenos = (n) => SERIES.filter((a) => a.count >= n)

/** Un personaje al azar, opcionalmente fuera de unos ids (`excluir`, un Set). */
export function personajeAlAzar(rng = Math.random, { excluir } = {}) {
  const lista = excluir?.size ? PERSONAJES.filter((c) => !excluir.has(c.id)) : PERSONAJES
  return elegirUno(lista, rng)
}

/**
 * `n` personajes distintos de la misma serie, elegida al azar entre las que
 * tienen al menos `n`. Devuelve { serie, personajes } (o undefined si no
 * hay ninguna serie tan grande).
 */
export function grupoDeUnaSerie(n, rng = Math.random, { excluirSeries } = {}) {
  const posibles = seriesConAlMenos(n).filter((a) => !excluirSeries?.has(a.id))
  const serie = elegirUno(posibles, rng)
  if (!serie) return undefined
  return { serie, personajes: elegirVarios(personajesDeSerie(serie.id), n, rng) }
}

/** `n` personajes, cada uno de una serie distinta (y distintas de `excluirSeries`). */
export function personajesDeSeriesDistintas(n, rng = Math.random, { excluirSeries } = {}) {
  return elegirDeSeriesDistintas(PERSONAJES, n, rng, { excluir: excluirSeries })
}

/** La serie de una carta ({ id, titulo, nativo, count, … }). */
export const serieDe = (carta) => catalogo.anime(carta.animeId)

/**
 * Popularidad de una carta: sus favoritos en AniList (`favs`), o 0 si el
 * catálogo aún no trae el dato. Los juegos que comparan popularidad deben
 * quedarse con las cartas que la tienen (ver conPopularidad).
 */
export const popularidad = (carta) => (Number.isInteger(carta.favs) ? carta.favs : 0)

/** Personajes con dato de popularidad (favoritos en AniList). */
export const conPopularidad = () => PERSONAJES.filter((c) => Number.isInteger(c.favs) && c.favs > 0)
