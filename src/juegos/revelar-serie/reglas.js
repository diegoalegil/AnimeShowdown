// ¿De qué serie?: las reglas, sin React. Una partida es un objeto que se
// renueva en cada jugada (intentar, pedirPista); el JSX solo lo pinta.
//
// Se ve la carta de un personaje, muy desenfocada, y hay que acertar su
// serie en cinco intentos. Cada intento gastado (un fallo o una pista) aclara
// el arte un paso. Las pistas: el nombre del personaje y la ficha de la serie
// (año y géneros). Se gana acertando la serie, comparando por animeId.
import { personajeAlAzar, serieDe } from '../comun/cartas.js'

export const MAX_INTENTOS = 5

/**
 * Desenfoque del arte (px) según los intentos gastados: fijo por paso, no se
 * anima. El último no llega a 0: muchas cartas llevan impreso el título de
 * la serie y con el arte nítido el quinto intento sería regalado.
 */
export const DESENFOQUE = [32, 24, 16, 10, 6]

/** Puntos por acertar según los intentos gastados (1.º = 100 … 5.º = 20). */
export const PUNTOS = [100, 80, 60, 40, 20]

/** Las dos pistas; cada una cuesta un intento. */
export const PISTAS = ['nombre', 'ficha']

/** Los géneros de AniList, en español. Los que no estén se muestran tal cual. */
const GENEROS = {
  Action: 'Acción',
  Adventure: 'Aventura',
  Comedy: 'Comedia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasía',
  Horror: 'Terror',
  'Mahou Shoujo': 'Chicas mágicas',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Misterio',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ciencia ficción',
  'Slice of Life': 'Recuentos de la vida',
  Sports: 'Deportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspense',
}

export const generoEnEspanol = (genero) => GENEROS[genero] ?? genero

/**
 * Una partida nueva: un personaje al azar (fuera de `excluir`, los ids ya
 * jugados en la sesión) y su serie.
 */
export function nuevaPartida(rng = Math.random, { excluir } = {}) {
  const objetivo = personajeAlAzar(rng, { excluir })
  return {
    objetivo,
    serie: serieDe(objetivo),
    intentos: [], // series probadas, en orden: { serie, acierto }
    pistas: [], // 'nombre' | 'ficha', en el orden en que se pidieron
    fin: null, // null mientras se juega; { ganada } al terminar
  }
}

/** Intentos gastados: los fallos más las pistas. */
export const intentosUsados = (partida) => partida.intentos.length + partida.pistas.length

export const intentosRestantes = (partida) => MAX_INTENTOS - intentosUsados(partida)

/** Desenfoque del arte ahora mismo (0 cuando la partida ha terminado). */
export function desenfoque(partida) {
  if (partida.fin) return 0
  return DESENFOQUE[Math.min(intentosUsados(partida), DESENFOQUE.length - 1)]
}

export const yaProbada = (partida, serie) => partida.intentos.some((i) => i.serie.id === serie.id)

/**
 * Prueba una serie. Devuelve la partida nueva; la misma si ya terminó o la
 * serie ya se había probado (no gasta intento).
 */
export function intentar(partida, serie) {
  if (partida.fin || yaProbada(partida, serie)) return partida
  const acierto = serie.id === partida.objetivo.animeId
  const intentos = [...partida.intentos, { serie, acierto }]
  const siguiente = { ...partida, intentos }
  const agotada = intentosUsados(siguiente) >= MAX_INTENTOS
  return acierto || agotada ? { ...siguiente, fin: { ganada: acierto } } : siguiente
}

/** Si la serie tiene algo que contar en la ficha (año o géneros). */
export const tieneFicha = (serie) => Boolean(serie?.anio || serie?.generos?.length)

/**
 * Si se puede pedir una pista: la partida sigue, no se pidió ya, queda más
 * de un intento (hay que guardar uno para responder) y hay dato que dar.
 */
export function puedePedirPista(partida, pista) {
  if (partida.fin || partida.pistas.includes(pista) || intentosRestantes(partida) <= 1) return false
  if (pista === 'ficha') return tieneFicha(partida.serie)
  return pista === 'nombre'
}

/** Pide una pista, que cuesta un intento. Devuelve la misma partida si no se puede. */
export function pedirPista(partida, pista) {
  if (!puedePedirPista(partida, pista)) return partida
  return { ...partida, pistas: [...partida.pistas, pista] }
}

/** Texto de la ficha de la serie: «2021 · Acción, Drama». */
export function textoFicha(serie) {
  const generos = (serie?.generos ?? []).map(generoEnEspanol).join(', ')
  return [serie?.anio, generos].filter(Boolean).join(' · ')
}

/** Puntos de la partida terminada: según los intentos gastados; 0 si se perdió o sigue. */
export function puntos(partida) {
  if (!partida.fin?.ganada) return 0
  return PUNTOS[Math.min(intentosUsados(partida) - 1, PUNTOS.length - 1)]
}

/** El título del acierto según lo que costó. */
export function nivel(partida) {
  if (!partida.fin?.ganada) return 'La serie guardó su secreto'
  const usados = intentosUsados(partida)
  if (usados === 1) return 'Otaku certificado'
  if (usados === 2) return 'Ojo entrenado'
  if (usados === 3) return 'Bien visto'
  if (usados === 4) return 'Por los pelos'
  return 'Justo a tiempo'
}

/**
 * Los personajes ya jugados en la sesión, para no repetirlos. Cuando se
 * agotan todos, se vuelve a empezar.
 */
export function anotarJugado(jugados, id, total) {
  const siguiente = new Set(jugados)
  siguiente.add(id)
  return siguiente.size >= total ? new Set() : siguiente
}
