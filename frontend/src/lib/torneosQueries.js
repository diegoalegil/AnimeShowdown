import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from './api.js'
import { queryKeys } from './queryClient.js'

/**
 * Hooks react-query para todas las lecturas/escrituras de torneos.
 * Aislados aquí para que las páginas no sepan ni de queryKeys ni de
 * cómo se invalida cada cosa. Plan v2 §1.1.
 */

/** Listado de torneos (TorneoResumenDto[]). 5 min stale, sin refetch en focus. */
export function useTorneos() {
  return useQuery({
    queryKey: queryKeys.torneos(),
    queryFn: endpoints.torneos,
  })
}

/**
 * Detalle de un torneo por slug (TorneoDetalleDto incluye `enfrentamientos`).
 *
 * Polling: si el torneo está IN_PROGRESS hacemos refetch cada 30s para captar
 * cambios de ronda en vivo sin necesidad de WebSocket (Plan v2 §1.1 — el
 * WS proper llega en Bloque 2.13). Para SCHEDULED y FINISHED no hace falta:
 * SCHEDULED es estático hasta que admin lo inicie, FINISHED es inmutable.
 *
 * El refetchInterval se ajusta solo viendo data.estado, así que un torneo
 * pasa automáticamente de "no polling" a "polling 30s" cuando admin lo
 * inicia, sin remontar el componente.
 */
export function useTorneoBySlug(slug) {
  return useQuery({
    queryKey: queryKeys.torneoBySlug(slug),
    queryFn: () => endpoints.torneoBySlug(slug),
    enabled: Boolean(slug),
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.estado === 'IN_PROGRESS' ? 30_000 : false
    },
  })
}

/**
 * Mutation para votar un enfrentamiento. Tras éxito invalida el detalle del
 * torneo al que pertenece el enfrentamiento — el caller pasa el slug para
 * saber qué cache refrescar.
 *
 * Errores comunes:
 *  - 401: usuario no logueado (el caller debe redirigir a /login).
 *  - 409: ya votó este enfrentamiento, o torneo no IN_PROGRESS.
 *  - 404: enfrentamiento no existe.
 */
export function useVotarEnfrentamiento(torneoSlug) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ enfrentamientoId, personajeGanadorId }) =>
      endpoints.votar(enfrentamientoId, personajeGanadorId),
    onSuccess: () => {
      if (torneoSlug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.torneoBySlug(torneoSlug) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.torneos() })
    },
  })
}
