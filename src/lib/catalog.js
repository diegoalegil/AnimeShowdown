// Catálogo estático: personajes, especiales y animes, con índices y búsqueda.
import personajesData from '../data/personajes.json'
import especialesData from '../data/especiales.json'
import animesData from '../data/animes.json'

/**
 * Crea las consultas sobre unas listas dadas. La aplicación usa los JSON del
 * repositorio (ver `catalogo` más abajo); los tests pasan listas pequeñas.
 */
export function crearCatalogo({ personajes, especiales, animes }) {
  const cartas = [...personajes, ...especiales]
  const porId = new Map(cartas.map((c) => [c.id, c]))
  const animePorId = new Map(animes.map((a) => [a.id, a]))
  const posicion = new Map(cartas.map((c, i) => [c.id, i]))

  const porAnime = new Map()
  for (const c of cartas) {
    const lista = porAnime.get(c.animeId)
    if (lista) lista.push(c)
    else porAnime.set(c.animeId, [c])
  }

  // Versiones especiales de cada personaje, en el orden del catálogo.
  const especialesDe = new Map()
  for (const e of especiales) {
    if (!e.personajeId) continue
    const lista = especialesDe.get(e.personajeId)
    if (lista) lista.push(e)
    else especialesDe.set(e.personajeId, [e])
  }

  const animesOrdenados = [...animes].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))

  // Texto de búsqueda precalculado, sin tildes ni mayúsculas.
  const indice = new Map()
  const textoDe = (c) => {
    let t = indice.get(c.id)
    if (t === undefined) {
      const anime = animePorId.get(c.animeId)
      t = normalizar([c.nombre, c.variante, c.nativo, c.anime, anime?.nativo].filter(Boolean).join(' '))
      indice.set(c.id, t)
    }
    return t
  }

  return {
    personajes,
    especiales,
    animes: animesOrdenados,
    total: cartas.length,

    carta: (id) => porId.get(id),
    anime: (id) => animePorId.get(id),
    cartasDeAnime: (animeId) => porAnime.get(animeId) ?? [],
    existe: (id) => porId.has(id),

    /**
     * La carta normal de un personaje seguida de sus especiales. Para una
     * especial devuelve la misma familia; una carta suelta va sola.
     */
    familia(id) {
      const carta = porId.get(id)
      if (!carta) return []
      const base = porId.get(carta.personajeId ?? carta.id)
      if (!base) return [carta]
      return [base, ...(especialesDe.get(base.id) ?? [])]
    },

    /** Carta anterior y siguiente en el orden del catálogo (circular). */
    vecinas(id) {
      const i = posicion.get(id)
      if (i === undefined) return { anterior: undefined, siguiente: undefined }
      return {
        anterior: cartas[(i - 1 + cartas.length) % cartas.length],
        siguiente: cartas[(i + 1) % cartas.length],
      }
    },

    /**
     * Filtra por texto (todas las palabras deben aparecer, en cualquier orden
     * y sin importar tildes) y opcionalmente por anime.
     */
    buscar(consulta = '', { animeId, lista = cartas } = {}) {
      const palabras = normalizar(consulta).split(' ').filter(Boolean)
      return lista.filter(
        (c) => (!animeId || c.animeId === animeId) && palabras.every((p) => textoDe(c).includes(p)),
      )
    },
  }
}

/** Minúsculas, sin tildes y con cualquier signo convertido en espacio. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export const esEspecial = (carta) => carta?.id?.startsWith('e-') ?? false

/** Número de catálogo tal como se imprime en la cartela: "0370" o "E-06". */
export function numeroCarta(carta) {
  return esEspecial(carta) ? `E-${String(carta.n).padStart(2, '0')}` : String(carta.n).padStart(4, '0')
}

export const catalogo = crearCatalogo({
  personajes: personajesData,
  especiales: especialesData,
  animes: animesData,
})
