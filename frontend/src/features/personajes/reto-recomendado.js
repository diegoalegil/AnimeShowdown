import {
  getStatsPersonaje,
  personajes,
} from '../../lib/personajes-core'

export function getRetoRecomendado(personaje) {
  const baseStats = getStatsPersonaje(personaje.slug)
  const mismoAnime = personajes.filter(
    (p) => p.anime === personaje.anime && p.slug !== personaje.slug,
  )
  const pool =
    mismoAnime.length > 0
      ? mismoAnime
      : personajes.filter((p) => p.slug !== personaje.slug)
  const rival = [...pool]
    .map((p) => ({
      personaje: p,
      stats: getStatsPersonaje(p.slug),
    }))
    .sort((a, b) => {
      const deltaA = Math.abs(a.stats.elo - baseStats.elo)
      const deltaB = Math.abs(b.stats.elo - baseStats.elo)
      if (deltaA !== deltaB) return deltaA - deltaB
      return b.stats.elo - a.stats.elo
    })[0]

  if (!rival) return null
  return {
    ...rival,
    delta: Math.abs(rival.stats.elo - baseStats.elo),
    tipo: mismoAnime.length > 0 ? 'mismo anime' : 'cross-anime',
  }
}
