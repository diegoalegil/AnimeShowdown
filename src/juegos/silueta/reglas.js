// Reglas de Silueta: una silueta tras un biombo de cuatro paneles, cinco
// intentos y una pista (la serie) que cuesta uno. El estado es inmutable:
// cada acción devuelve uno nuevo (o el mismo si no procede).
import { elegirUno } from '../comun/azar.js'
import { PERSONAJES } from '../comun/cartas.js'
import disponibles from './disponibles.json'

export const MAX_INTENTOS = 5
export const PANELES = 4
/** Qué panel abre cada fallo: centro-izquierda, centro-derecha, izquierda, derecha. */
export const ORDEN_APERTURA = [1, 2, 0, 3]
/** Los personajes del catálogo visible que tienen silueta (ver scripts/generate-siluetas.mjs). */
const CON_SILUETA = new Set(disponibles)
export const CANDIDATOS = PERSONAJES.filter((c) => CON_SILUETA.has(c.id))

/**
 * Empieza una ronda con un objetivo al azar entre los candidatos. `excluir`
 * (Set de ids) evita repetir los ya jugados; si los agota, vale cualquiera.
 */
export function nuevaRonda(rng = Math.random, { excluir } = {}) {
  const libres = excluir?.size ? CANDIDATOS.filter((c) => !excluir.has(c.id)) : CANDIDATOS
  const objetivo = elegirUno(libres.length ? libres : CANDIDATOS, rng)
  // pistaEn: cuántos personajes se habían probado al pedir la pista (para listarla en su sitio).
  return { objetivo, intentos: [], pista: false, pistaEn: null, fin: null }
}

/** Intentos gastados: los personajes probados más la pista, si se usó. */
export const intentosUsados = (estado) => estado.intentos.length + (estado.pista ? 1 : 0)
export const restantes = (estado) => MAX_INTENTOS - intentosUsados(estado)
export const esAcierto = (estado, carta) => carta.id === estado.objetivo.id
export const yaIntentado = (estado, carta) => estado.intentos.some((c) => c.id === carta.id)

/** Paneles abiertos, en orden de apertura: uno por fallo (la pista cuenta), todos al acertar y ninguno al perder. */
export function panelesAbiertos(estado) {
  if (estado.fin === 'victoria') return [...ORDEN_APERTURA]
  if (estado.fin === 'derrota') return []
  const fallos = estado.intentos.filter((c) => !esAcierto(estado, c)).length + (estado.pista ? 1 : 0)
  return ORDEN_APERTURA.slice(0, Math.min(PANELES, fallos))
}

/** Prueba un personaje. Si la ronda terminó o ya se probó, devuelve el mismo estado. */
export function intentar(estado, carta) {
  if (estado.fin || yaIntentado(estado, carta)) return estado
  const intentos = [...estado.intentos, carta]
  const siguiente = { ...estado, intentos }
  if (esAcierto(estado, carta)) return { ...siguiente, fin: 'victoria' }
  return intentosUsados(siguiente) >= MAX_INTENTOS ? { ...siguiente, fin: 'derrota' } : siguiente
}

/** La pista (la serie del objetivo) se puede pedir una vez y nunca como último intento. */
export const pistaDisponible = (estado) => !estado.fin && !estado.pista && restantes(estado) > 1

export function usarPista(estado) {
  return pistaDisponible(estado) ? { ...estado, pista: true, pistaEn: estado.intentos.length } : estado
}

/** Si ya se enseña qué intentos comparten serie con el objetivo (a partir del segundo, para no regalarla). */
export const muestraMismaSerie = (estado) => Boolean(estado.fin) || estado.intentos.length >= 2
export const mismaSerie = (estado, carta) => carta.animeId === estado.objetivo.animeId && !esAcierto(estado, carta)

/** Puntos de una ronda ganada: 5 por acertar a la primera, 1 por acertar con el último intento. */
export const puntosDe = (estado) => (estado.fin === 'victoria' ? MAX_INTENTOS + 1 - intentosUsados(estado) : 0)

/** Título del resultado según cuánto costó. */
export function tituloDe(estado) {
  if (estado.fin !== 'victoria') return 'La sombra guardó su secreto'
  const usados = intentosUsados(estado)
  if (usados === 1) return 'Precisión legendaria'
  if (usados === 2) return estado.pista ? 'Precisión con pista' : 'Reflejo increíble'
  if (usados === 3) return 'Bien visto'
  if (usados === 4) return 'Por los pelos'
  return 'Justo a tiempo'
}
