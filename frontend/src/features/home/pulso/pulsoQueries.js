import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../../lib/api'

/**
 * Stale-time del bloque "en vivo" de la home: 1min recarga
 * silenciosamente cuando el usuario vuelve tras un rato.
 */
export const PULSE_STALE = 60 * 1000

/**
 * Ranking all-time de la comunidad, compartido por el Pulso y por el
 * hogar del hero: misma key y mismo stale-time para que ambos consuman
 * UNA sola request (TanStack dedupe por queryKey). Si esta query
 * divergiera entre consumidores, cada uno dispararía la suya — por eso
 * vive aquí y no inline en cada componente.
 */
export function useRankingPulso() {
  return useQuery({
    queryKey: ['pulso', 'ranking'],
    queryFn: endpoints.ranking,
    staleTime: PULSE_STALE,
  })
}
