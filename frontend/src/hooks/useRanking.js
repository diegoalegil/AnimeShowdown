import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'

/**
 * Hooks de ranking segmentado (Plan v2 §4.6).
 *
 * - useRankingSegmentado({periodo, anime, limit}): top N personajes por
 *   votos en una ventana temporal o filtrados por anime.
 * - useAnimesConVotos(): lista para popular dropdown del tab por-anime.
 */

export function useRankingSegmentado({
  periodo = 'all',
  anime,
  limit = 50,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: ['ranking', 'segmentado', periodo, anime ?? '', limit],
    queryFn: () => endpoints.rankingSegmentado({ periodo, anime, limit }),
    enabled,
    staleTime: 60 * 1000, // 1 min: el ranking no cambia tan rápido
  })
}

export function useAnimesConVotos({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['ranking', 'animes-disponibles'],
    queryFn: endpoints.animesConVotos,
    enabled,
    staleTime: 10 * 60 * 1000, // 10 min: cambia muy lento
  })
}
