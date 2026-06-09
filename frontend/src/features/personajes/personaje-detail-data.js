import { getStatsPersonaje } from '../../lib/personajes-core'

function createEloReader(getStats) {
  const cache = new Map()

  return (slug) => {
    if (!cache.has(slug)) {
      cache.set(slug, getStats(slug)?.elo ?? 0)
    }
    return cache.get(slug)
  }
}

function sortRankedByEloDesc(items) {
  return [...items].sort((a, b) => b.elo - a.elo)
}

function selectDuelosPopulares({ personaje, slug, rankedGlobal, rankedAnime }) {
  const usados = new Set([slug])
  const out = []

  const addCandidate = (candidato) => {
    if (!candidato || usados.has(candidato.slug)) return
    usados.add(candidato.slug)
    out.push(candidato)
  }

  for (const { personaje: candidato } of rankedAnime) {
    addCandidate(candidato)
    if (out.length >= 6) return out
  }

  for (const { personaje: candidato } of rankedGlobal) {
    if (candidato.anime === personaje.anime) continue
    addCandidate(candidato)
    if (out.length >= 6) return out
  }

  return out
}

export function buildPersonajeDetailContext({
  catalogo = [],
  personaje,
  slug,
  idx,
  getStats = getStatsPersonaje,
} = {}) {
  if (!personaje || !slug || idx < 0 || catalogo.length === 0) return null

  const readElo = createEloReader(getStats)
  const prev = catalogo[(idx - 1 + catalogo.length) % catalogo.length]
  const next = catalogo[(idx + 1) % catalogo.length]
  const rankedGlobal = sortRankedByEloDesc(
    catalogo.map((p) => ({ personaje: p, elo: readElo(p.slug) })),
  )
  const rankGlobal = rankedGlobal.findIndex((item) => item.personaje.slug === slug) + 1
  const animePersonajes = catalogo.filter((p) => p.anime === personaje.anime)
  const rankedAnime = sortRankedByEloDesc(
    animePersonajes.map((p) => ({ personaje: p, elo: readElo(p.slug) })),
  )
  const rankAnime = rankedAnime.findIndex((item) => item.personaje.slug === slug) + 1
  const relacionados = animePersonajes
    .filter((p) => p.slug !== slug)
    .slice(0, 10)

  return {
    prev,
    next,
    rankGlobal,
    animePersonajes,
    rankAnime,
    relacionados,
    duelosPopulares: selectDuelosPopulares({
      personaje,
      slug,
      rankedGlobal,
      rankedAnime,
    }),
    totalAnime: animePersonajes.length,
  }
}
