import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'

/**
 * Recomendaciones cross-anime "Más como X" (Plan v2 §4.12).
 *
 * <p>Llama a {@code GET /api/personajes/{slug}/similares}. Cache 5min en
 * el backend, staleTime 5min en cliente para no spamear con cada cambio
 * de slug en la ficha.
 *
 * @param slug slug del personaje target
 * @param limit cantidad a pedir (default 8, max 24 — el backend clampa)
 */
export function usePersonajesSimilares(slug, { limit = 8 } = {}) {
  return useQuery({
    queryKey: ['personajes', 'similares', slug, limit],
    queryFn: () => endpoints.personajesSimilares(slug, { limit }),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  })
}
