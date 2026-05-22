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
      // Audit externo B2.1a/B2.1b (2026-05-22): el backend devuelve dos
      // métricas — votos (físico, COUNT) para mostrar al usuario, y
      // pesoVotos (ponderado, SUM(peso)) para ORDER BY. Aquí actualizamos
      // ambos en la caché live. El sort se hace por pesoVotos para no
      // desalinearse del orden REST cuando un voto anónimo (peso 0.3)
      // aterriza junto a uno registrado (peso 1.0). Si el WS no incluye
      // pesoVotos (server antiguo), fallback a votos como antes.
      queryClient
        .getQueriesData({ queryKey: ['ranking', 'segmentado'] })
        .forEach(([queryKey, old]) => {
          if (!Array.isArray(old)) return
          const [, , periodo = 'all', anime = '', limit = old.length] = queryKey
          if (anime && anime !== delta.personaje.anime) return
          const index = old.findIndex((item) => item?.personaje?.slug === delta.personaje.slug)
          const existing = index === -1 ? null : old[index]
          const incrementoVotos = delta.delta || 1
          // Cuando llega el delta, el server puede mandarnos el total
          // absoluto (periodo='all', voto sobre todo el catálogo) o un
          // incremento sobre el estado anterior (ventana temporal).
          const votos =
            periodo === 'all'
              ? delta.votos
              : Math.max(0, (existing?.votos || 0) + incrementoVotos)
          // Mismo patrón para pesoVotos: si server moderno lo manda,
          // úsalo; si no, asumimos que el incremento equivale a un voto
          // registrado (1.0) en ventana temporal, o caemos a votos en
          // all-time. Esto cubre el modo casual sin backend mientras el
          // resto del payload llega.
          const incrementoPeso =
            typeof delta.pesoVotos === 'number'
              ? delta.pesoVotos - (existing?.pesoVotos ?? existing?.votos ?? 0)
              : incrementoVotos
          const pesoVotos =
            periodo === 'all'
              ? typeof delta.pesoVotos === 'number'
                ? delta.pesoVotos
                : votos
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
