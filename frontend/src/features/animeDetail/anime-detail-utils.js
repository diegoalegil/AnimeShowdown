import { getLocalVoteStats } from '../../lib/localVoteRanking'

export const EMPTY_PERSONAL_ANIME_STATS = {
  total: 0,
  uniqueCharacters: 0,
  top: [],
  latest: [],
}

export function getPersonalAnimeStats(data, localVotes) {
  if (!data) return EMPTY_PERSONAL_ANIME_STATS

  const animeSlugs = new Set(data.personajes.map((personaje) => personaje.slug))
  const animeVotes = localVotes.filter((vote) => animeSlugs.has(vote.ganadorSlug))
  return getLocalVoteStats(animeVotes)
}

export function getAnimeTotalVotes(personajes, porElo) {
  return personajes.reduce((acc, personaje) => {
    const stats = porElo.find((item) => item.slug === personaje.slug)
    return acc + (stats ? stats.wins + stats.losses : 0)
  }, 0)
}

export function buildTop5AnimeHref(top10) {
  if (top10.length === 0) return '/mi-top5'
  const slugs = top10
    .slice(0, 5)
    .map((personaje) => personaje.slug)
    .join(',')
  return `/mi-top5?add=${encodeURIComponent(slugs)}`
}
