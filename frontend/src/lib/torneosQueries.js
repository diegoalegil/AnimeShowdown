import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from './api.js'
import { queryKeys } from './queryClient.js'
import { useStompSubscription } from '../hooks/useStompSubscription.js'

/**
 * Mapping del enum del backend (SCHEDULED/IN_PROGRESS/FINISHED) a las
 * etiquetas visuales que usa el frontend. Reemplaza al `estadoBadge` que
 * vivía en frontend/src/data/torneos.js con keys legacy en español.
 */
export const ESTADO_BADGE = {
  SCHEDULED: {
    label: 'Próximamente',
    dot: 'bg-accent',
    color: 'text-gold',
  },
  IN_PROGRESS: {
    label: 'En curso',
    dot: 'bg-emerald-400',
    color: 'text-emerald-400',
  },
  FINISHED: {
    label: 'Finalizado',
    dot: 'bg-fg-muted',
    color: 'text-fg-muted',
  },
}

/** Fallback defensivo si llega un estado desconocido del backend. */
export function getEstadoBadge(estado) {
  return ESTADO_BADGE[estado] ?? ESTADO_BADGE.SCHEDULED
}

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
 * Doble canal de updates (Plan v2 §2.13):
 *   1. Polling 30s mientras el torneo está IN_PROGRESS (fallback si el WS
 *      no conecta — proxies corporativos, mobile en red mala, etc).
 *   2. WebSocket STOMP suscrito a /topic/torneo.{id}.bracket: cuando alguien
 *      vota, el server pushea un BracketUpdateEvent y aquí invalidamos la
 *      query para refetch instantáneo. Sin esperar a la siguiente vuelta
 *      del polling.
 *
 * El refetchInterval se ajusta solo viendo data.estado, así que un torneo
 * pasa automáticamente de "no polling" a "polling 30s" cuando admin lo
 * inicia, sin remontar el componente.
 */
export function useTorneoBySlug(slug) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.torneoBySlug(slug),
    queryFn: () => endpoints.torneoBySlug(slug),
    enabled: Boolean(slug),
    refetchInterval: (q) => {
      const data = q.state.data
      return data?.estado === 'IN_PROGRESS' ? 30_000 : false
    },
  })

  // Suscripción WS solo si tenemos id de torneo y está IN_PROGRESS. Para
  // SCHEDULED no hay votos, para FINISHED no hay cambios.
  const torneoId = query.data?.id
  const estaEnCurso = query.data?.estado === 'IN_PROGRESS'
  const destination =
    torneoId && estaEnCurso ? `/topic/torneo.${torneoId}.bracket` : null
  const { lastMessage } = useStompSubscription(destination)

  useEffect(() => {
    if (!lastMessage || !slug) return
    // Recibimos { torneoId, enfrentamientoId, conteos... }. Invalidamos la
    // query: el cache se marcará stale y se refetch automáticamente — más
    // simple y robusto que reconciliar conteos manualmente con setQueryData,
    // porque el refetch trae también ganador/ronda actualizados si el match
    // se cerró por el voto.
    queryClient.invalidateQueries({ queryKey: queryKeys.torneoBySlug(slug) })
  }, [lastMessage, queryClient, slug])

  return query
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
