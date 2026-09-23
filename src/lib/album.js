// Álbum de la colección: una hoja por serie, con un hueco numerado para cada
// carta, y una hoja final con las especiales. Aquí solo hay datos y cuentas;
// la página está en pages/Coleccion.jsx.
import { catalogo, esEspecial } from './catalog.js'
import { ESPECIALES } from './filtros.js'

/** Hojas del álbum en orden de catálogo: [{ id, titulo, nativo, orden, cartas, especiales }]. */
export function crearHojas(cat = catalogo) {
  const porSerie = new Map()
  for (const carta of cat.personajes) {
    let hoja = porSerie.get(carta.animeId)
    if (!hoja) {
      const anime = cat.anime(carta.animeId)
      hoja = {
        id: carta.animeId,
        titulo: anime?.titulo ?? carta.anime,
        nativo: anime?.nativo,
        orden: porSerie.size + 1,
        cartas: [],
        especiales: false,
      }
      porSerie.set(carta.animeId, hoja)
    }
    hoja.cartas.push(carta)
  }
  const hojas = [...porSerie.values()]
  if (cat.especiales.length) {
    hojas.push({ id: ESPECIALES, titulo: 'Especiales', nativo: '特別', orden: hojas.length + 1, cartas: cat.especiales, especiales: true })
  }
  return hojas
}

/** Cuántas cartas de la lista hay en `tengo`. */
export const cuantasTengo = (cartas, tengo) => cartas.reduce((n, c) => n + (Object.hasOwn(tengo, c.id) ? 1 : 0), 0)

/**
 * Progreso de la colección: { personajes: { tengo, total }, especiales: {…},
 * porHoja: Map(id → tengo) }.
 */
export function progreso(hojas, tengo) {
  const porHoja = new Map()
  const personajes = { tengo: 0, total: 0 }
  const especiales = { tengo: 0, total: 0 }
  for (const hoja of hojas) {
    const n = cuantasTengo(hoja.cartas, tengo)
    porHoja.set(hoja.id, n)
    const grupo = hoja.especiales ? especiales : personajes
    grupo.tengo += n
    grupo.total += hoja.cartas.length
  }
  return { personajes, especiales, porHoja }
}

/**
 * Cartas distintas de una colección (`tengo`) contadas como en el álbum:
 * personajes y especiales por separado. Es la cuenta que muestran la
 * cabecera, los sobres y la colección.
 */
export function recuento(tengo, cat = catalogo) {
  const r = { personajes: { tengo: 0, total: cat.personajes.length }, especiales: { tengo: 0, total: cat.especiales.length } }
  for (const id of Object.keys(tengo)) {
    const carta = cat.carta(id)
    if (carta) r[esEspecial(carta) ? 'especiales' : 'personajes'].tengo++
  }
  return r
}

const plural = (n, singular, varias) => `${n} ${n === 1 ? singular : varias}`

/**
 * «405 de 1086 cartas · 6 de 52 especiales»; sin `total`, «405 cartas y 6
 * especiales» (las especiales solo si hay alguna).
 */
export function textoRecuento({ personajes, especiales }, { total = true } = {}) {
  if (total) return `${personajes.tengo} de ${plural(personajes.total, 'carta', 'cartas')} · ${especiales.tengo} de ${plural(especiales.total, 'especial', 'especiales')}`
  const cartas = plural(personajes.tengo, 'carta', 'cartas')
  return especiales.tengo ? `${cartas} y ${plural(especiales.tengo, 'especial', 'especiales')}` : cartas
}

/** Fracción entre 0 y 1, para las líneas de progreso. */
export const fraccion = ({ tengo, total }) => (total > 0 ? Math.min(tengo / total, 1) : 0)

/** Porcentaje entero para leer: nunca dice 100 % sin estar completa ni 0 % si hay alguna. */
export function porcentaje({ tengo, total }) {
  if (!total || !tengo) return 0
  if (tengo >= total) return 100
  return Math.min(Math.max(Math.round((tengo / total) * 100), 1), 99)
}

// ---------------------------------------------------------------------------
// Filtros del álbum en la URL: ?serie=<id|especiales>&ver=empezadas
// ---------------------------------------------------------------------------

export const EMPEZADAS = 'empezadas'

export function leerFiltrosAlbum(params, hojas) {
  const pedida = params.get('serie') ?? ''
  const serie = hojas.some((h) => h.id === pedida) ? pedida : ''
  return { serie, empezadas: params.get('ver') === EMPEZADAS }
}

export function busquedaAlbum({ serie = '', empezadas = false } = {}) {
  const params = new URLSearchParams()
  if (serie) params.set('serie', serie)
  if (empezadas) params.set('ver', EMPEZADAS)
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

/** Hojas que se muestran: una serie concreta, o todas (o solo las empezadas). */
export function filtrarHojas(hojas, { serie, empezadas }, porHoja) {
  if (serie) return hojas.filter((h) => h.id === serie)
  if (empezadas) return hojas.filter((h) => (porHoja.get(h.id) ?? 0) > 0)
  return hojas
}

/** Texto de una opción del selector: «Chainsaw Man 3/22». */
export const etiquetaHoja = (hoja, tengo) => `${hoja.titulo} ${tengo}/${hoja.cartas.length}`

/**
 * Reparte ids de cartas por hoja: Map(idHoja → 'id id …'). Las hojas reciben
 * texto para que su memo compare valores y no referencias.
 */
export function idsPorHoja(ids, cat = catalogo) {
  const listas = new Map()
  for (const id of ids) {
    const carta = cat.carta(id)
    if (!carta) continue
    const hoja = esEspecial(carta) ? ESPECIALES : carta.animeId
    const lista = listas.get(hoja)
    if (lista) lista.push(id)
    else listas.set(hoja, [id])
  }
  return new Map([...listas].map(([hoja, lista]) => [hoja, lista.join(' ')]))
}

/**
 * Filas que ocupa una hoja con 3, 5 y 6 columnas: el CSS las usa para
 * reservar su altura mientras no se pinta (content-visibility).
 */
export function filasHoja(n) {
  return { 3: Math.ceil(n / 3), 5: Math.ceil(n / 5), 6: Math.ceil(n / 6) }
}
