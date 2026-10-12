// El banco de preguntas del oráculo. Cada pregunta se responde con los datos
// del catálogo: `aplica(carta)` devuelve true, false o null (no se sabe: el
// dato falta). Así el oráculo nunca pregunta nada que no pueda comprobar, y
// una respuesta que contradiga los datos del personaje sellado es mentira.
import { catalogo } from '../../lib/catalog.js'
import { PERSONAJES, popularidad, serieDe } from '../comun/cartas.js'

/** Géneros de AniList y cómo se preguntan. */
export const GENEROS = {
  Action: 'de acción',
  Adventure: 'de aventuras',
  Comedy: 'de comedia',
  Drama: 'un drama',
  Ecchi: 'ecchi',
  Fantasy: 'de fantasía',
  Horror: 'de terror',
  'Mahou Shoujo': 'de chicas mágicas',
  Mecha: 'de mechas',
  Music: 'de música',
  Mystery: 'de misterio',
  Psychological: 'psicológica',
  Romance: 'romántica',
  'Sci-Fi': 'de ciencia ficción',
  'Slice of Life': 'de recuentos de la vida',
  Sports: 'de deportes',
  Supernatural: 'sobrenatural',
  Thriller: 'de suspense',
}

/** Décadas de estreno, de la más antigua a la más reciente. */
const DECADAS = [
  { id: 'xx', texto: '¿Su serie se estrenó antes del año 2000?', desde: -Infinity, hasta: 1999 },
  { id: '2000', texto: '¿Su serie se estrenó entre 2000 y 2009?', desde: 2000, hasta: 2009 },
  { id: '2010', texto: '¿Su serie se estrenó entre 2010 y 2019?', desde: 2010, hasta: 2019 },
  { id: '2020', texto: '¿Su serie se estrenó en 2020 o después?', desde: 2020, hasta: Infinity },
]

/** Umbrales de episodios: por encima o no. */
const EPISODIOS = [12, 26, 60, 150]

/** Tramos de popularidad (favoritos en AniList), como fracción del catálogo. */
const POPULARIDAD = [
  { id: 'top10', texto: '¿Está entre el 10 % más querido del catálogo?', fraccion: 0.1 },
  { id: 'top25', texto: '¿Está entre el 25 % más querido del catálogo?', fraccion: 0.25 },
  { id: 'top50', texto: '¿Está en la mitad más querida del catálogo?', fraccion: 0.5 },
]

/** Estaciones del cumpleaños por mes (01-12). */
const ESTACIONES = [
  { id: 'invierno', texto: '¿Cumple años en invierno (diciembre a febrero)?', meses: [12, 1, 2] },
  { id: 'primavera', texto: '¿Cumple años en primavera (marzo a mayo)?', meses: [3, 4, 5] },
  { id: 'verano', texto: '¿Cumple años en verano (junio a agosto)?', meses: [6, 7, 8] },
  { id: 'otono', texto: '¿Cumple años en otoño (septiembre a noviembre)?', meses: [9, 10, 11] },
]

const KATAKANA = /[゠-ヿ]/
const KANJI = /[一-鿿]/
const VOCALES = /^[aeiou]/i

/** La franquicia de una serie: lo que va antes de «/» o «:» («Fate/Zero» → «Fate»). */
export const franquiciaDe = (serie) => serie.titulo.split(/[/:]/)[0].trim()

/** Primera palabra del nombre, solo letras, en minúsculas y sin tildes. */
export function primerNombre(carta) {
  return carta.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z]/gi, '')
    .toLowerCase()
}

/** Mes (1-12) de un cumpleaños «MM-DD», o null. */
const mesDe = (carta) => (typeof carta.cumple === 'string' && /^\d{2}-\d{2}$/.test(carta.cumple) ? Number(carta.cumple.slice(0, 2)) : null)

/**
 * Construye el banco para unos personajes. `serie(carta)` da su serie,
 * `especial(carta)` dice si tiene una versión especial. Las preguntas de
 * serie, franquicia y género solo entran si parten el grupo (al menos un
 * personaje a cada lado); las demás dependen del dato de cada personaje.
 */
export function crearBanco(personajes, { serie = serieDe, especial = tieneEspecial } = {}) {
  const banco = []
  const agregar = (id, tipo, texto, aplica) => banco.push({ id, tipo, texto, aplica })

  // Género del personaje.
  agregar('genero', 'genero', '¿Es una chica?', (c) => (c.genero === 'F' ? true : c.genero === 'M' ? false : null))

  // Serie y franquicia.
  const series = new Map()
  const tamano = new Map()
  for (const c of personajes) {
    const s = serie(c)
    if (!s) continue
    series.set(s.id, s)
    tamano.set(s.id, (tamano.get(s.id) ?? 0) + 1)
  }
  const franquicias = new Map()
  for (const s of series.values()) {
    const f = franquiciaDe(s)
    franquicias.set(f, (franquicias.get(f) ?? 0) + 1)
  }
  for (const s of series.values()) {
    if (tamano.get(s.id) < personajes.length) agregar(`serie:${s.id}`, 'serie', `¿Es de ${s.titulo}?`, (c) => c.animeId === s.id)
  }
  for (const [f, n] of franquicias) {
    if (n >= 2) {
      agregar(`franquicia:${f}`, 'franquicia', `¿Es de la franquicia ${f}?`, (c) => {
        const s = serie(c)
        return s ? franquiciaDe(s) === f : null
      })
    }
  }

  // Géneros de la serie (solo los que aparecen).
  const generos = new Set()
  for (const s of series.values()) for (const g of s.generos ?? []) generos.add(g)
  for (const g of generos) {
    const como = GENEROS[g] ?? `de ${g.toLowerCase()}`
    agregar(`genero-serie:${g}`, 'genero-serie', `¿Su serie es ${como}?`, (c) => {
      const s = serie(c)
      return Array.isArray(s?.generos) && s.generos.length ? s.generos.includes(g) : null
    })
  }

  // Década de estreno y duración de la serie.
  for (const d of DECADAS) {
    agregar(`decada:${d.id}`, 'decada', d.texto, (c) => {
      const anio = serie(c)?.anio
      return Number.isInteger(anio) ? anio >= d.desde && anio <= d.hasta : null
    })
  }
  for (const n of EPISODIOS) {
    agregar(`episodios:${n}`, 'episodios', `¿Su serie tiene más de ${n} episodios?`, (c) => {
      const eps = serie(c)?.episodios
      return Number.isInteger(eps) ? eps > n : null
    })
  }

  // Popularidad por tramos: la posición entre los que tienen el dato.
  const conFavs = personajes.filter((c) => popularidad(c) > 0).sort((a, b) => popularidad(b) - popularidad(a))
  const posicion = new Map(conFavs.map((c, i) => [c.id, i]))
  for (const t of POPULARIDAD) {
    const corte = Math.ceil(conFavs.length * t.fraccion)
    agregar(`popularidad:${t.id}`, 'popularidad', t.texto, (c) => {
      const i = posicion.get(c.id)
      return i === undefined ? null : i < corte
    })
  }

  // El nombre: inicial, longitud, apellido, escritura japonesa.
  agregar('inicial:vocal', 'nombre', '¿Su nombre empieza por vocal?', (c) => VOCALES.test(primerNombre(c)))
  agregar('inicial:a-m', 'nombre', '¿Su nombre empieza por una letra de la A a la M?', (c) => {
    const l = primerNombre(c)[0]
    return l ? l <= 'm' : null
  })
  agregar('inicial:s', 'nombre', '¿Su nombre empieza por S?', (c) => primerNombre(c)[0] === 's')
  agregar('inicial:k', 'nombre', '¿Su nombre empieza por K?', (c) => primerNombre(c)[0] === 'k')
  agregar('inicial:m', 'nombre', '¿Su nombre empieza por M?', (c) => primerNombre(c)[0] === 'm')
  agregar('nombre:largo', 'nombre', '¿Su nombre de pila tiene más de cinco letras?', (c) => primerNombre(c).length > 5)
  agregar('nombre:corto', 'nombre', '¿Su nombre de pila tiene cuatro letras o menos?', (c) => primerNombre(c).length <= 4)
  agregar('nombre:apellido', 'nombre', '¿Se le conoce por nombre y apellido (dos palabras o más)?', (c) => c.nombre.trim().split(/\s+/).length > 1)
  agregar('nativo:katakana', 'nativo', '¿Su nombre en japonés se escribe solo en katakana (nombre extranjero)?', (c) =>
    c.nativo ? KATAKANA.test(c.nativo) && !KANJI.test(c.nativo) : null,
  )
  agregar('nativo:kanji', 'nativo', '¿Su nombre en japonés lleva kanji?', (c) => (c.nativo ? KANJI.test(c.nativo) : null))

  // Versión especial y cumpleaños.
  agregar('especial', 'especial', '¿Tiene una carta especial en la colección?', (c) => especial(c))
  for (const e of ESTACIONES) {
    agregar(`cumple:${e.id}`, 'cumple', e.texto, (c) => {
      const m = mesDe(c)
      return m === null ? null : e.meses.includes(m)
    })
  }
  agregar('cumple:primer-semestre', 'cumple', '¿Cumple años en la primera mitad del año (enero a junio)?', (c) => {
    const m = mesDe(c)
    return m === null ? null : m <= 6
  })

  return banco
}

/** Si el personaje tiene alguna versión especial en el catálogo. */
export const tieneEspecial = (carta) => catalogo.familia(carta.id).length > 1

let bancoCatalogo = null

/** El banco sobre todo el catálogo, construido una vez. */
export function banco() {
  if (!bancoCatalogo) bancoCatalogo = crearBanco(PERSONAJES)
  return bancoCatalogo
}
