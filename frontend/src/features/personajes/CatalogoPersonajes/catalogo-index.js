import {
  getPopularidad,
  getStatsPersonaje,
} from '../../../lib/personajes-core'
import { getCategoriasPersonaje } from '../../../data/personajes-tags'

const DEFAULT_ELO_BOUNDS = { min: 1000, max: 2300, top: 0 }

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function compareEloDesc(a, b) {
  return b.elo - a.elo || a.nombre.localeCompare(b.nombre)
}

export function crearCatalogoIndex(
  catalogoPersonajes,
  {
    getStats = getStatsPersonaje,
    getPopularity = getPopularidad,
    getCategories = getCategoriasPersonaje,
  } = {},
) {
  const items = catalogoPersonajes.map((personaje) => {
    const stats = getStats(personaje.slug)
    return {
      ...personaje,
      ...stats,
      popularidad: getPopularity(personaje.slug),
      categorias: getCategories(personaje.slug),
      searchText: `${normalizeText(personaje.nombre)} ${normalizeText(personaje.anime)}`,
    }
  })

  const rankedElo = [...items].sort(compareEloDesc)
  const rankPorSlug = new Map(rankedElo.map((personaje, index) => [personaje.slug, index + 1]))
  const animeCounts = new Map()
  for (const item of items) {
    if (!item.anime) continue
    animeCounts.set(item.anime, (animeCounts.get(item.anime) ?? 0) + 1)
  }

  const animes = Array.from(animeCounts.entries())
    .sort(([animeA, countA], [animeB, countB]) => countB - countA || animeA.localeCompare(animeB))
  const animeFilterOptions = [
    '',
    ...Array.from(animeCounts.keys()).sort((a, b) => a.localeCompare(b)),
  ]
  const eloBounds = items.length === 0
    ? DEFAULT_ELO_BOUNDS
    : eloBoundsFromItems(items)

  return {
    items,
    rankedElo,
    rankPorSlug,
    animes,
    animeFilterOptions,
    eloBounds,
  }
}

function eloBoundsFromItems(items) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const item of items) {
    if (item.elo < min) min = item.elo
    if (item.elo > max) max = item.elo
  }
  return {
    min: Math.floor(min / 25) * 25,
    max: Math.ceil(max / 25) * 25,
    top: max,
  }
}

export function filtrarCatalogo(
  catalogoIndex,
  {
    normalizedSearch = '',
    animeFilter = null,
    tagFilter = null,
    sort = 'elo_desc',
    eloMin = null,
    eloMax = null,
  } = {},
) {
  let list = catalogoIndex.items
  if (animeFilter) list = list.filter((personaje) => personaje.anime === animeFilter)
  if (tagFilter) {
    list = list.filter((personaje) => personaje.categorias.includes(tagFilter))
  }
  if (eloMin != null || eloMax != null) {
    list = list.filter((personaje) => {
      if (eloMin != null && personaje.elo < eloMin) return false
      if (eloMax != null && personaje.elo > eloMax) return false
      return true
    })
  }
  if (normalizedSearch) {
    list = list.filter((personaje) => personaje.searchText.includes(normalizedSearch))
  }

  switch (sort) {
    case 'popularidad':
      return [...list].sort((a, b) => b.popularidad - a.popularidad || compareEloDesc(a, b))
    case 'elo_desc':
      return [...list].sort(compareEloDesc)
    case 'elo_asc':
      return [...list].sort((a, b) => a.elo - b.elo || a.nombre.localeCompare(b.nombre))
    case 'nombre_az':
      return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre))
    case 'nombre_za':
      return [...list].sort((a, b) => b.nombre.localeCompare(a.nombre))
    case 'anime':
      return [...list].sort((a, b) => a.anime.localeCompare(b.anime) || a.nombre.localeCompare(b.nombre))
    default:
      return list
  }
}

export function filtrarRankingElo(rankedElo, { normalizedSearch = '', animeFilter = '' } = {}) {
  let list = rankedElo
  if (animeFilter) list = list.filter((personaje) => personaje.anime === animeFilter)
  if (normalizedSearch) {
    list = list.filter((personaje) => personaje.searchText.includes(normalizedSearch))
  }
  return list
}
