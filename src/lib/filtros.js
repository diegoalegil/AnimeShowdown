// Filtros de la galería: búsqueda de texto y serie. Viven en la URL
// (?q=…&serie=…) para sobrevivir a una recarga y a atrás/adelante, y la ficha
// los hereda para recorrer las cartas en el mismo orden.
import { catalogo, esEspecial } from './catalog.js'

/** Valor del filtro de serie que muestra las cartas especiales. */
export const ESPECIALES = 'especiales'

const MAX_CONSULTA = 80

/** Lee los filtros de unos URLSearchParams; lo desconocido se ignora. */
export function leerFiltros(params, cat = catalogo) {
  const q = (params.get('q') ?? '').slice(0, MAX_CONSULTA)
  const pedida = params.get('serie') ?? ''
  const serie = pedida === ESPECIALES || cat.anime(pedida) ? pedida : ''
  return { q, serie }
}

/** Cadena de búsqueda para la URL: «?serie=…&q=…» o «» sin filtros. */
export function busquedaDe({ q = '', serie = '' } = {}) {
  const params = new URLSearchParams()
  if (serie) params.set('serie', serie)
  if (q) params.set('q', q)
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

export const hayFiltros = ({ q, serie }) => Boolean(q.trim() || serie)

// La galería y la ficha piden la misma lista: se recuerda la última.
const memoria = new WeakMap()

/**
 * Cartas que muestran unos filtros, en orden de catálogo. Sin serie o con
 * una serie concreta son personajes; con ESPECIALES, las especiales.
 */
export function filtrarCartas({ q, serie }, cat = catalogo) {
  const clave = `${serie}\u0000${q}`
  const ultima = memoria.get(cat)
  if (ultima?.clave === clave) return ultima.lista
  const especiales = serie === ESPECIALES
  const lista = cat.buscar(q, {
    lista: especiales ? cat.especiales : cat.personajes,
    animeId: especiales ? undefined : serie || undefined,
  })
  memoria.set(cat, { clave, lista })
  return lista
}

/**
 * Posición de una carta dentro de la lista filtrada y sus vecinas (sin dar
 * la vuelta). Una especial que no esté en la lista se sitúa donde está su
 * personaje; si la carta no aparece con esos filtros, se recorre el catálogo
 * completo de su tipo y `filtrada` es false.
 */
export function recorrido(filtros, carta, cat = catalogo) {
  let lista = filtrarCartas(filtros, cat)
  let indice = indiceEn(lista, carta)
  let filtrada = hayFiltros(filtros)
  if (indice < 0) {
    lista = esEspecial(carta) ? cat.especiales : cat.personajes
    indice = lista.findIndex((c) => c.id === carta.id)
    filtrada = false
  }
  return {
    indice,
    total: lista.length,
    anterior: indice > 0 ? lista[indice - 1] : undefined,
    siguiente: indice >= 0 && indice < lista.length - 1 ? lista[indice + 1] : undefined,
    filtrada,
  }
}

function indiceEn(lista, carta) {
  const i = lista.findIndex((c) => c.id === carta.id)
  if (i >= 0 || !carta.personajeId) return i
  return lista.findIndex((c) => c.id === carta.personajeId)
}

/** Texto corto que describe los filtros: «Chainsaw Man», «Especiales», «“rem”». */
export function etiquetaFiltros({ q, serie }, cat = catalogo) {
  const partes = []
  if (serie === ESPECIALES) partes.push('Especiales')
  else if (serie) partes.push(cat.anime(serie)?.titulo ?? serie)
  if (q.trim()) partes.push(`«${q.trim()}»`)
  return partes.join(' · ')
}

// Orden de cada serie en el catálogo (01, 02…), según su primera carta.
const ordenSeries = new WeakMap()
function ordenDe(cat, animeId) {
  let orden = ordenSeries.get(cat)
  if (!orden) {
    orden = new Map()
    for (const c of cat.personajes) if (!orden.has(c.animeId)) orden.set(c.animeId, orden.size + 1)
    ordenSeries.set(cat, orden)
  }
  return orden.get(animeId) ?? 0
}

/**
 * Agrupa cartas consecutivas de la misma serie:
 * [{ anime, orden, cartas }]. `orden` es la posición de la serie en el catálogo.
 */
export function agruparPorSerie(cartas, cat = catalogo) {
  const grupos = []
  for (const carta of cartas) {
    const ultimo = grupos.at(-1)
    if (ultimo?.anime.id === carta.animeId) ultimo.cartas.push(carta)
    else {
      const anime = cat.anime(carta.animeId) ?? { id: carta.animeId, titulo: carta.anime }
      grupos.push({ anime, orden: ordenDe(cat, carta.animeId), cartas: [carta] })
    }
  }
  return grupos
}
