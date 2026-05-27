import { useCallback, useState } from 'react'
import { recordDailyVote } from '../../../lib/dailyProgress'
import { getLocalVoteStats, recordLocalVote } from '../../../lib/localVoteRanking'

export function useVoteSessionStats() {
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    bySlug: {},
    closeDuels: 0,
    lastShareText: '',
  })
  const [personalVoteImpact, setPersonalVoteImpact] = useState(null)

  const trackLocalVote = useCallback((ganador, perdedor, data) => {
    recordDailyVote()
    const localVotes = recordLocalVote(ganador, perdedor)
    const localStats = getLocalVoteStats(localVotes)
    const rankIndex = localStats.top.findIndex((item) => item.slug === ganador.slug)
    const localRank = rankIndex >= 0 ? localStats.top[rankIndex] : null
    const impact = localRank
      ? {
          slug: ganador.slug,
          nombre: ganador.nombre,
          rank: rankIndex + 1,
          count: localRank.count,
          total: localStats.total,
        }
      : null
    setPersonalVoteImpact(impact)
    const votosGanador = Number(data?.votosGanador)
    const votosPerdedor = Number(data?.votosPerdedor)
    const isClose =
      Number.isFinite(votosGanador) &&
      Number.isFinite(votosPerdedor) &&
      Math.abs(votosGanador - votosPerdedor) <= 1
    setSessionStats((prev) => {
      const bySlug = { ...prev.bySlug }
      const current = bySlug[ganador.slug] || {
        nombre: ganador.nombre,
        anime: ganador.anime,
        count: 0,
      }
      bySlug[ganador.slug] = {
        ...current,
        count: current.count + 1,
      }
      const total = prev.total + 1
      const top = Object.values(bySlug)
        .sort((x, y) => y.count - x.count)
        .slice(0, 3)
        .map((p) => `${p.nombre} x${p.count}`)
        .join(', ')
      const lastShareText = [
        `Voté ${ganador.nombre} sobre ${perdedor?.nombre ?? 'su rival'} en AnimeShowdown.`,
        data?.votosGanador != null
          ? `${ganador.nombre} suma ${data.votosGanador} votos en este duelo.`
          : 'Mi voto acaba de mover el ranking casual.',
        top ? `Mi sesión: ${total} votos. Top: ${top}.` : `Mi sesión: ${total} votos.`,
      ].join('\n')
      return {
        total,
        bySlug,
        closeDuels: prev.closeDuels + (isClose ? 1 : 0),
        lastShareText,
      }
    })
    return impact
  }, [])

  return {
    sessionStats,
    personalVoteImpact,
    setPersonalVoteImpact,
    trackLocalVote,
  }
}
