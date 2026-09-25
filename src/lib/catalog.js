// Catálogo estático: personajes, especiales y animes, con índices y búsqueda.
import personajesData from '../data/personajes.json'
import especialesData from '../data/especiales.json'
import animesData from '../data/animes.json'
import ocultasData from '../data/ocultas.json'

/**
 * Crea las consultas sobre unas listas dadas. La aplicación usa los JSON del
 * repositorio (ver `catalogo` más abajo); los tests pasan listas pequeñas.
 *
 * Las cartas de `ocultas` ([{ id, motivo }]) siguen en los datos pero no
 * existen para la aplicación: no salen en la galería, los sobres, el álbum ni
 * las cuentas, y no tienen ficha. Este es el único sitio que las filtra.
 */
export function crearCatalogo({ personajes: todosPersonajes, especiales: todasEspeciales, animes: todosAnimes, ocultas = [] }) {
  const idsOcultos = new Set(ocultas.map((o) => o.id))
  const enDatos = new Map([...todosPersonajes, ...todasEspeciales].map((c) => [c.id, c]))
  const personajes = todosPersonajes.filter((c) => !idsOcultos.has(c.id))
  const especiales = todasEspeciales.filter((c) => !idsOcultos.has(c.id)).map((e) => huerfana(e, idsOcultos, enDatos))

  const cartas = [...personajes, ...especiales]
  const porId = new Map(cartas.map((c) => [c.id, c]))
  const posicion = new Map(cartas.map((c, i) => [c.id, i]))

  // `count` de animes.json cuenta todos los personajes de los datos; la
  // aplicación muestra los visibles.
  const visiblesPorAnime = new Map()
  for (const c of personajes) visiblesPorAnime.set(c.animeId, (visiblesPorAnime.get(c.animeId) ?? 0) + 1)
  const animes = todosAnimes.map((a) => ({ ...a, count: visiblesPorAnime.get(a.id) ?? 0 }))
  const animePorId = new Map(animes.map((a) => [a.id, a]))

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

  // Una serie sin personajes visibles no se ofrece en los filtros ni se cuenta.
  const animesOrdenados = animes.filter((a) => a.count > 0).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))

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
    /** La carta está en los datos pero oculta (ver `ocultas`). */
    oculta: (id) => idsOcultos.has(id) && enDatos.has(id),
    /**
     * La carta está en los datos, visible u oculta. La colección guardada
     * conserva las dos: una carta que se vuelve a mostrar reaparece con sus copias.
     */
    conocida: (id) => enDatos.has(id),

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

/**
 * Una especial cuyo personaje está oculto se queda sin versión normal: la
 * ficha la muestra sola. Conserva el nombre original y la descripción del
 * personaje, que la ficha tomaba de su carta normal.
 */
function huerfana(especial, idsOcultos, enDatos) {
  const base = idsOcultos.has(especial.personajeId) ? enDatos.get(especial.personajeId) : undefined
  if (!base) return especial
  const heredado = { ...especial }
  if (heredado.nativo === undefined && base.nativo !== undefined) heredado.nativo = base.nativo
  if (heredado.desc === undefined && base.desc !== undefined) heredado.desc = base.desc
  return heredado
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
  ocultas: ocultasData,
})
