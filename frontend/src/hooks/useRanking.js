import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { subscribe } from '../lib/stomp.js'

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
    refetchInterval: 30 * 1000, // fallback si WebSocket no conecta
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

/**
 * Ranking actual con indicadores de movimiento ↑↓/Nuevo (Plan v2 §4.x).
 * Comparativa frente al ranking de hace {@code dias} días.
 */
export function useRankingMovimientos({
  limit = 50,
  dias = 7,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: ['ranking', 'movimientos', limit, dias],
    queryFn: () => endpoints.rankingMovimientos({ limit, dias }),
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  })
}

export function useRankingDeltaSubscription({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return undefined
    return subscribe('/topic/ranking-delta', (delta) => {
      if (!delta?.personaje?.slug) return
      queryClient
        .getQueriesData({ queryKey: ['ranking', 'segmentado'] })
        .forEach(([queryKey, old]) => {
          if (!Array.isArray(old)) return
          const [, , periodo = 'all', anime = '', limit = old.length] = queryKey
          if (anime && anime !== delta.personaje.anime) return
          const index = old.findIndex((item) => item?.personaje?.slug === delta.personaje.slug)
          const votos =
            periodo === 'all'
              ? delta.votos
              : Math.max(0, (index === -1 ? 0 : old[index].votos || 0) + (delta.delta || 1))
          const nextItem = {
            personaje: delta.personaje,
            votos,
          }
          const next =
            index === -1
              ? [...old, nextItem]
              : old.map((item, i) => (i === index ? { ...item, votos } : item))
          next.sort((a, b) => {
            const byVotes = (b.votos || 0) - (a.votos || 0)
            if (byVotes !== 0) return byVotes
            return (a.personaje?.id || 0) - (b.personaje?.id || 0)
          })
          queryClient.setQueryData(queryKey, next.slice(0, Number(limit) || next.length))
        })
      queryClient.invalidateQueries({ queryKey: ['ranking', 'movimientos'] })
    })
  }, [enabled, queryClient])
}
