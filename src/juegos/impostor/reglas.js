// Reglas del Impostor: tres rondas; en cada una, cuatro personajes de una
// serie y un intruso de otra, barajados. Se gana el trial acertando las tres.
import { barajar, elegirUno, elegirVarios } from '../comun/azar.js'
import { PERSONAJES, personajesDeSerie, seriesConAlMenos } from '../comun/cartas.js'
import { normalizar } from '../../lib/catalog.js'

export const RONDAS = 3
export const SEGUNDOS = 15
export const EN_LA_SERIE = 4
/** Puntos por ronda acertada, más uno por cada segundo que sobre. */
export const PUNTOS_ACIERTO = 10
/** Series preferidas: con al menos cinco personajes, para que los cuatro cambien de un trial a otro. */
const MINIMO_PREFERIDO = 5

/**
 * «Familia» de una serie: la primera palabra de su título normalizado
 * («fate» para Fate/Zero y Fate/stay night, «dragon» para Dragon Ball y
 * Dragon Ball Z). Sirve para no sacar un intruso de una serie hermana,
 * que sería indistinguible por estilo.
 */
export function familiaDe(serie) {
  return normalizar(serie?.titulo ?? '').split(/[^a-z0-9]+/)[0] || ''
}

/** Series que pueden ser base: al menos cinco personajes; si no hay, al menos cuatro. */
export function seriesBase() {
  const preferidas = seriesConAlMenos(MINIMO_PREFERIDO)
  return preferidas.length ? preferidas : seriesConAlMenos(EN_LA_SERIE)
}

/**
 * Una ronda: la serie base, sus cuatro personajes y un intruso de otra
 * familia, los cinco barajados. `excluirSeries` evita repetir base dentro
 * del mismo trial. Devuelve undefined si el catálogo no da para una ronda.
 */
export function nuevaRonda(rng = Math.random, { excluirSeries } = {}) {
  const posibles = seriesBase().filter((s) => !excluirSeries?.has(s.id))
  const serie = elegirUno(posibles.length ? posibles : seriesBase(), rng)
  if (!serie) return undefined
  const familia = familiaDe(serie)
  const propios = elegirVarios(personajesDeSerie(serie.id), EN_LA_SERIE, rng)
  const ajenos = PERSONAJES.filter((c) => c.animeId !== serie.id && familiaDe({ titulo: c.anime }) !== familia)
  const impostor = elegirUno(ajenos.length ? ajenos : PERSONAJES.filter((c) => c.animeId !== serie.id), rng)
  if (!impostor || propios.length < EN_LA_SERIE) return undefined
  return { serie, impostor, cartas: barajar([...propios, impostor], rng) }
}

/** Un trial: tres rondas con series base distintas. */
export function nuevaPartida(rng = Math.random) {
  const rondas = []
  const usadas = new Set()
  for (let i = 0; i < RONDAS; i++) {
    const ronda = nuevaRonda(rng, { excluirSeries: usadas })
    if (!ronda) break
    usadas.add(ronda.serie.id)
    rondas.push(ronda)
  }
  return rondas
}

/** ¿La carta elegida (por id) era el intruso? Sin elección (tiempo agotado) es fallo. */
export const esAcierto = (ronda, idElegida) => idElegida != null && idElegida === ronda.impostor.id

/** Puntos de una ronda: 0 si falla; si acierta, la base más los segundos que sobraron. */
export function puntosDeRonda(acierto, segundosRestantes = 0) {
  if (!acierto) return 0
  return PUNTOS_ACIERTO + Math.max(0, Math.min(SEGUNDOS, Math.floor(segundosRestantes)))
}

/** Rango según aciertos: el trial solo se gana con los tres. */
export function rangoDe(aciertos) {
  if (aciertos >= RONDAS) return 'Detective infalible'
  if (aciertos === 2) return 'Buen ojo'
  if (aciertos === 1) return 'Ronda salvada'
  return 'Engaño total'
}

/** Resumen del trial a partir de los resultados de cada ronda ({ acierto, puntos }). */
export function resumenDe(resultados) {
  const aciertos = resultados.filter((r) => r.acierto).length
  const puntos = resultados.reduce((suma, r) => suma + r.puntos, 0)
  return { aciertos, puntos, ganada: aciertos === RONDAS, rango: rangoDe(aciertos) }
}
