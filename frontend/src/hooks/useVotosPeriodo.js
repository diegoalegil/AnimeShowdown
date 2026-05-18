import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError, endpoints } from '../lib/api'
import { queryKeys } from '../lib/queryClient'

/**
 * Hooks de "actividad reciente de votos" (sprint 2026-05-18).
 *
 * <p>Diseño:
 *   - useVotosPeriodo(slug, { dias }) — request individual. Pensado
 *     para la ficha de personaje, donde solo nos importa UN slug.
 *   - useVotosPeriodoBatch(slugs, { dias }) — request única para una
 *     lista de slugs; devuelve un Map<slug, dto> para consulta O(1).
 *     Pensado para listas (MoversCard, FavoritosBanner) donde habría
 *     N+1 si pidiéramos uno por uno.
 *
 * <p>Cache compartido por queryKey: si dos componentes piden el mismo
 * slug con los mismos días, solo hay 1 request.
 *
 * <p>staleTime 60s: el dato cambia despacio (votos suman lentamente);
 * refrescar más rápido sería ruido sin valor.
 */
const STALE_MS = 60 * 1000

export function useVotosPeriodo(slug, { dias = 7 } = {}) {
  return useQuery({
    queryKey: queryKeys.votosPeriodoSlug(slug, dias),
    queryFn: () => endpoints.votosPeriodoPersonaje(slug, { dias }),
    enabled: Boolean(slug),
    staleTime: STALE_MS,
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 1,
  })
}

export function useVotosPeriodoBatch(slugs, { dias = 7 } = {}) {
  // Normalizamos la lista: filtramos vacíos, deduplicamos, ordenamos
  // para que dos llamadas con el mismo set de slugs en distinto orden
  // hagan hit en la misma queryKey.
  const slugsNorm = useMemo(() => {
    if (!Array.isArray(slugs)) return []
    return Array.from(new Set(slugs.filter(Boolean))).sort()
  }, [slugs])

  const query = useQuery({
    queryKey: queryKeys.votosPeriodoBatch(slugsNorm, dias),
    queryFn: () => endpoints.votosPeriodoBatch({ slugs: slugsNorm, dias }),
    enabled: slugsNorm.length > 0,
    staleTime: STALE_MS,
  })

  // Conveniencia: exponemos un Map<slug, dto> precomputado para que el
  // caller no tenga que hacer find/lookup en cada render.
  const bySlug = useMemo(() => {
    const m = new Map()
    if (Array.isArray(query.data)) {
      for (const item of query.data) m.set(item.slug, item)
    }
    return m
  }, [query.data])

  return { ...query, bySlug }
}
