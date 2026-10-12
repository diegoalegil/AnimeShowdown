// Fin de ronda: anotar el resultado y, si toca, dar el sobre. Es la única
// puerta por la que los juegos tocan el progreso y la colección.
import { coleccion } from '../../lib/useCollection.js'
import { progreso } from './useProgreso.js'

/**
 * Cierra una ronda de `juego` (una entrada de registro.js). Anota la ronda
 * en el progreso (racha, récord, mejor puntuación) y, si se ganó y el juego
 * da recompensa, concede un sobre extra que se abre en /sobres.
 *
 * Se llama UNA vez por ronda, cuando termina. Devuelve:
 *   { sobreGanado, extras, racha, record, jugadas, ganadas, mejor }
 * donde `extras` son los sobres extra que quedan por abrir.
 *
 * @param {{ slug: string, recompensa: boolean }} juego
 * @param {{ ganada: boolean, puntos?: number }} resultado
 */
export function terminarRonda(juego, { ganada, puntos = 0 }) {
  const sobreGanado = Boolean(ganada && juego.recompensa)
  const extras = sobreGanado ? coleccion.ganarSobres(1) : coleccion.getSnapshot().extras
  const avance = progreso.anotarRonda(juego.slug, { ganada, puntos, sobre: sobreGanado })
  return { sobreGanado, extras, ...avance }
}

/** Sobres extra que quedan por abrir ahora mismo (para textos como «tienes 3 sobres esperando»). */
export const sobresExtraPorAbrir = () => coleccion.getSnapshot().extras
