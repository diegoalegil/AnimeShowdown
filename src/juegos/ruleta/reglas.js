// Ruleta del destino: la lógica pura. Un tambor vertical con nombres gira
// y se para exacto en el elegido. El elegido se sortea ANTES de girar; la
// coreografía solo tiene que aterrizar en él (ver planificarGiro).
import { elegirVarios, entero } from '../comun/azar.js'
import { PERSONAJES } from '../comun/cartas.js'

/** Nombres que caben en el tambor a la vez (bastantes para que no se repitan a la vista, pocos para que pese nada). */
export const ROSTER_MAX = 60

/** Cada tantos giros se cambia el roster, para que no salgan siempre los mismos. */
export const GIROS_POR_ROSTER = 12

/** Alto de cada celda del tambor en px: debe coincidir con --ruleta-celda del css. */
export const ALTO_CELDA = 64

/** Vueltas enteras mínimas de espectáculo antes de parar. */
export const VUELTAS_MIN = 4

/** Fases del giro en ms: aceleración (½at²), crucero y freno (cúbico, sin salto de velocidad). */
export const ACELERACION_MS = 300
export const CRUCERO_MS = 900
export const FRENO_MS = 1400

/** Lo que dura un giro completo. */
export const DURACION_GIRO = ACELERACION_MS + CRUCERO_MS + FRENO_MS

/** Recorrido mínimo en px, para que un destino cercano no se quede en un giro corto. */
const RECORRIDO_MIN = 2600

/** Estirado vertical máximo del carrete en pleno crucero (efecto de velocidad, solo transform). */
const ESTIRADO = 0.02

/** Un roster nuevo: hasta ROSTER_MAX personajes distintos, en orden aleatorio. */
export function nuevoRoster(rng = Math.random, lista = PERSONAJES) {
  return elegirVarios(lista, ROSTER_MAX, rng)
}

/** Índice del elegido dentro del roster. Se decide antes de girar. */
export const sortear = (roster, rng = Math.random) => entero(roster.length, rng)

/** Si toca renovar el roster antes del giro número `giros` (contados desde 1). */
export const tocaRenovar = (giros) => giros > 0 && giros % GIROS_POR_ROSTER === 0

/**
 * Posición del carrete (translateY en px) para que la celda `y / alto` quede
 * bajo el visor. El carrete pinta tres copias del roster y la ventana enseña
 * tres celdas: con y ≡ i·alto (mod vuelta), la celda i de la copia central
 * ocupa la del medio.
 */
export function posicionCarrete(y, n, alto = ALTO_CELDA) {
  const vuelta = n * alto
  let m = y % vuelta
  if (m < 0) m += vuelta
  return alto - m - vuelta
}

/**
 * Planifica un giro desde la posición `desde` (px) hasta la celda `indice`
 * de un roster de `n` celdas. Devuelve la distancia, la duración y la
 * posición en cada instante; el aterrizaje es exacto: `destino` cae justo
 * en la celda elegida tras al menos VUELTAS_MIN vueltas enteras.
 */
export function planificarGiro(desde, indice, n, alto = ALTO_CELDA) {
  const vuelta = n * alto
  let inicio = desde % vuelta
  if (inicio < 0) inicio += vuelta

  let delta = (indice * alto - inicio) % vuelta
  if (delta <= 0) delta += vuelta
  const vueltas = Math.max(VUELTAS_MIN, Math.ceil((RECORRIDO_MIN - delta) / vuelta))
  const distancia = delta + vueltas * vuelta

  // Velocidad de crucero tal que las tres fases suman la distancia:
  // ½·v·acel + v·crucero + ⅓·v·freno (el freno cúbico recorre un tercio).
  const v = distancia / (ACELERACION_MS / 2 + CRUCERO_MS + FRENO_MS / 3)
  const dAcel = (v * ACELERACION_MS) / 2
  const dCrucero = v * CRUCERO_MS

  /** Posición y estirado en el instante t (ms desde el arranque). */
  function en(t) {
    if (t <= 0) return { y: inicio, escala: 1 }
    if (t < ACELERACION_MS) {
      return { y: inicio + (v * t * t) / (2 * ACELERACION_MS), escala: 1 + ESTIRADO * (t / ACELERACION_MS) }
    }
    if (t < ACELERACION_MS + CRUCERO_MS) {
      return { y: inicio + dAcel + v * (t - ACELERACION_MS), escala: 1 + ESTIRADO }
    }
    if (t < DURACION_GIRO) {
      const p = (t - ACELERACION_MS - CRUCERO_MS) / FRENO_MS
      const resto = (1 - p) ** 3
      return { y: inicio + dAcel + dCrucero + (distancia - dAcel - dCrucero) * (1 - resto), escala: 1 + ESTIRADO * (1 - p) ** 2 }
    }
    return { y: inicio + distancia, escala: 1 }
  }

  return { inicio, destino: inicio + distancia, distancia, vueltas, duracion: DURACION_GIRO, en }
}

/** Lo que anuncia el lector de pantalla al parar el tambor. */
export const anuncioDe = (carta) => `El destino eligió a ${carta.nombre}, de ${carta.anime}.`
