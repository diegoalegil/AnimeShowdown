import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { subscribe } from '../lib/stomp.js'

/**
 * Hooks de ranking segmentado.
 *
 * - useRankingSegmentado({periodo, anime, limit}): top N personajes por
 *   votos en una ventana temporal o filtrados por anime.
 * - useAnimesConVotos(): lista para popular dropdown del tab por-anime.
 */

export function useRankingSegmentado({
  periodo = 'all',
  anime,
  categoria,
  limit = 50,
  enabled = true,
} = {}) {
  return useQuery({
    // categoria (intención de voto, feature #15) entra en el queryKey para que
    // su caché sea independiente. El orden posicional importa: el delta WS lo
    // desestructura por posición en useRankingDeltaSubscription.
    queryKey: ['ranking', 'segmentado', periodo, anime ?? '', categoria ?? '', limit],
    queryFn: () => endpoints.rankingSegmentado({ periodo, anime, categoria, limit }),
    enabled,
    staleTime: 60 * 1000, // 1 min: el ranking no cambia tan rápido
    // El ranking se actualiza en vivo por delta WS (useRankingDeltaSubscription);
    // este poll es solo el fallback si el WS no conecta. Alineado a 60s con el
    // staleTime y el TTL de caché del backend para no refetchear redundante.
    refetchInterval: 60 * 1000,
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
 * Categorías de intención (feature #15) con al menos un voto. Pobla el
 * sub-selector 'Por intención' de /ranking sin pintar chips vacíos.
 */
export function useCategoriasConVotos({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['ranking', 'categorias-disponibles'],
    queryFn: endpoints.categoriasConVotos,
    enabled,
    staleTime: 10 * 60 * 1000, // 10 min: cambia muy lento
  })
}

/**
 * Ranking actual con indicadores de movimiento ↑↓/Nuevo.
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
    // Fallback por si el WS no conecta; alineado a 60s con el TTL de caché
    // del backend (ranking-movimientos 1min) para no refetchear redundante.
    refetchInterval: 60 * 1000,
  })
}

export function useRankingDeltaSubscription({ enabled = true } = {}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return undefined
    return subscribe('/topic/ranking-delta', (delta) => {
      if (!delta?.personaje?.slug) return
      // El backend manda cuatro métricas para mantener la caché live alineada
      // con el ORDER BY del REST sin contaminar ventanas temporales:
      //   - votos: total físico all-time (COUNT). Para mostrar al usuario.
      //   - delta: score visible añadido (1 normal, 0.5 por lado en empate).
      //   - pesoVotos: total ponderado all-time (SUM(peso)).
      //   - deltaPeso: peso del voto recién emitido (0.3/1.0 normal;
      //     0.15/0.5 por lado en empate).
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
          const [, , periodo = 'all', anime = '', categoria = '', limit = old.length] = queryKey
          // El delta global del WS NO es consciente de la categoría (publica
          // totales all-time del personaje). Aplicarlo a una caché por
          // intención la corrompería con totales globales → la saltamos; esas
          // listas refrescan por su refetchInterval (feature #15).
          if (categoria) return
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
