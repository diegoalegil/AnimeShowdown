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
      // Audit externo B2.1a/B2.1b/B2.2 (2026-05-22/23): el backend manda
      // cuatro métricas para mantener la caché live alineada con el ORDER
      // BY del REST sin contaminar ventanas temporales:
      //   - votos: total físico all-time (COUNT). Para mostrar al usuario.
      //   - delta: votos físicos añadidos (siempre 1 hoy).
      //   - pesoVotos: total ponderado all-time (SUM(peso)).
      //   - deltaPeso: peso del voto recién emitido (0.3 anon / 1.0 reg).
      // Para periodo='all' usamos los TOTALES absolutos del backend.
      // Para ventanas temporales (mes/trimestre/año) usamos los INCREMENTOS
      // (delta y deltaPeso) sobre el valor actual de la caché — antes
      // restábamos pesoVotos absoluto contra el de la caché temporal y
      // contaminábamos la ventana con el histórico (un personaje con 150
      // all-time y 2 mensuales saltaba a 151 en mensual hasta el refetch).
      const hasPeso = typeof delta.pesoVotos === 'number'
      const hasDeltaPeso = typeof delta.deltaPeso === 'number'
      const incrementoVotos = delta.delta || 1
      // Si el server no manda deltaPeso (compat con WS antiguo o modo
      // casual), asumimos el incremento de votos físicos como fallback.
      const incrementoPeso = hasDeltaPeso ? delta.deltaPeso : incrementoVotos
      queryClient
        .getQueriesData({ queryKey: ['ranking', 'segmentado'] })
        .forEach(([queryKey, old]) => {
          if (!Array.isArray(old)) return
          const [, , periodo = 'all', anime = '', limit = old.length] = queryKey
          if (anime && anime !== delta.personaje.anime) return
          const isAllTime = periodo === 'all'
          // Para ventanas temporales sin deltaPeso confiable preferimos
          // invalidar para que el siguiente refetch traiga la realidad,
          // en vez de mutar con datos potencialmente inconsistentes.
          if (!isAllTime && !hasDeltaPeso) {
            queryClient.invalidateQueries({ queryKey })
            return
          }
          const index = old.findIndex((item) => item?.personaje?.slug === delta.personaje.slug)
          const existing = index === -1 ? null : old[index]
          const votos = isAllTime
            ? delta.votos
            : Math.max(0, (existing?.votos || 0) + incrementoVotos)
          const pesoVotos = isAllTime
            ? (hasPeso ? delta.pesoVotos : votos)
            : Math.max(0, (existing?.pesoVotos ?? existing?.votos ?? 0) + incrementoPeso)
          const nextItem = {
            personaje: delta.personaje,
            votos,
            pesoVotos,
          }
          const next =
            index === -1
              ? [...old, nextItem]
              : old.map((item, i) => (i === index ? { ...item, votos, pesoVotos } : item))
          next.sort((a, b) => {
            const valorA = a.pesoVotos ?? a.votos ?? 0
            const valorB = b.pesoVotos ?? b.votos ?? 0
            const byPeso = valorB - valorA
            if (byPeso !== 0) return byPeso
            return (a.personaje?.id || 0) - (b.personaje?.id || 0)
          })
          queryClient.setQueryData(queryKey, next.slice(0, Number(limit) || next.length))
        })
      queryClient.invalidateQueries({ queryKey: ['ranking', 'movimientos'] })
    })
  }, [enabled, queryClient])
}
