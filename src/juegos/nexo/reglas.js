import { barajar } from '../comun/azar.js'
import { grupoDeUnaSerie } from '../comun/cartas.js'

/** Parejas por tablero y errores que se perdonan antes de perder. */
export const PAREJAS = 4
export const MAX_ERRORES = 3

/**
 * Un tablero: cuatro series distintas con dos personajes cada una, las ocho
 * cartas barajadas. Cada naipe guarda su índice en el tablero (1–8 para el
 * teclado) y la serie a la que pertenece.
 */
export function nuevoTablero(rng = Math.random) {
  const parejas = []
  const usadas = new Set()
  while (parejas.length < PAREJAS) {
    const grupo = grupoDeUnaSerie(2, rng, { excluirSeries: usadas })
    if (!grupo) break
    usadas.add(grupo.serie.id)
    parejas.push(grupo)
  }
  const naipes = barajar(
    parejas.flatMap(({ serie, personajes }) => personajes.map((carta) => ({ carta, animeId: serie.id }))),
    rng,
  ).map((naipe, indice) => ({ ...naipe, indice }))
  return { parejas, naipes }
}

/** Estado de una partida recién empezada sobre un tablero. */
export function estadoInicial() {
  return { destapadas: [], unidas: [], intentos: 0, errores: 0, fin: null }
}

/** Las dos destapadas no casan y esperan a volver a taparse. */
export const hayFallo = (estado) => estado.destapadas.length === 2 && !estado.fin

/**
 * Destapa el naipe `indice`. Si ya hay dos destapadas que no casan, primero
 * las tapa (así el jugador rápido no espera). Al destapar la segunda cuenta
 * el intento: si comparten serie, la pareja queda unida; si no, es un error.
 * La ronda acaba al unir las cuatro (victoria) o al pasar de MAX_ERRORES
 * (derrota). Devuelve el mismo estado si la jugada no vale.
 */
export function destapar(tablero, estado, indice) {
  if (estado.fin) return estado
  const naipe = tablero.naipes[indice]
  if (!naipe || estado.unidas.includes(naipe.animeId)) return estado

  const base = hayFallo(estado) ? taparFallo(estado) : estado
  if (base.destapadas.includes(indice)) return estado

  const destapadas = [...base.destapadas, indice]
  if (destapadas.length < 2) return { ...base, destapadas }

  const [a, b] = destapadas.map((i) => tablero.naipes[i])
  const intentos = base.intentos + 1
  if (a.animeId === b.animeId) {
    const unidas = [...base.unidas, a.animeId]
    const fin = unidas.length === tablero.parejas.length ? 'victoria' : null
    return { ...base, destapadas: [], unidas, intentos, fin }
  }
  const errores = base.errores + 1
  const fin = errores > MAX_ERRORES ? 'derrota' : null
  return { ...base, destapadas: fin ? [] : destapadas, intentos, errores, fin }
}

/** Tapa las dos destapadas que no casaban. */
export function taparFallo(estado) {
  return hayFallo(estado) ? { ...estado, destapadas: [] } : estado
}

/** Estado de un naipe para pintarlo: tapada | destapada | fallo | unida. */
export function estadoDelNaipe(tablero, estado, indice) {
  const naipe = tablero.naipes[indice]
  if (estado.unidas.includes(naipe.animeId)) return 'unida'
  if (estado.fin === 'derrota') return 'destapada'
  if (!estado.destapadas.includes(indice)) return 'tapada'
  return hayFallo(estado) ? 'fallo' : 'destapada'
}

/**
 * Puntos de una victoria: 100 menos 20 por error y 1 por cada dos segundos,
 * nunca por debajo de 10. Una derrota no puntúa.
 */
export function puntuacion(estado, segundos) {
  if (estado.fin !== 'victoria') return 0
  return Math.max(10, 100 - estado.errores * 20 - Math.floor(Math.max(0, segundos) / 2))
}

/** Iniciales del nombre (dos letras), para el dorso del naipe. */
export function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const letras = partes.length >= 2 ? partes[0][0] + partes[1][0] : (partes[0] ?? '').slice(0, 2)
  return letras.toUpperCase()
}

/** Tiempo en m:ss. */
export function formatoTiempo(segundos) {
  const s = Math.max(0, Math.floor(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
