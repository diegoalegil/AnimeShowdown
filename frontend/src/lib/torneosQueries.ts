import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from './api.js'
import { queryKeys } from './queryClient.js'
import { useStompSubscription } from '../hooks/useStompSubscription.js'

type EstadoBadge = {
  label: string
  dot: string
  color: string
}

type TorneoDetalleMinimo = {
  id?: string | number
  estado?: string
  enfrentamientos?: EnfrentamientoVivo[]
  currentMatch?: EnfrentamientoVivo | null
  [key: string]: unknown
}

type PersonajeMiniVivo = {
  id?: string | number | null
  [key: string]: unknown
}

type EnfrentamientoVivo = {
  id?: string | number | null
  personaje1?: PersonajeMiniVivo | null
  personaje2?: PersonajeMiniVivo | null
  personaje1Votos?: number | null
  personaje2Votos?: number | null
  totalVotos?: number | null
  [key: string]: unknown
}

type BracketUpdateEvent = {
  enfrentamientoId?: string | number | null
  personaje1Id?: string | number | null
  personaje1Votos?: unknown
  personaje2Id?: string | number | null
  personaje2Votos?: unknown
  totalVotos?: unknown
}

type VotoEnfrentamientoPayload = {
  enfrentamientoId: string | number
  personajeGanadorId: string | number
}

/**
 * Mapping del enum del backend (SCHEDULED/IN_PROGRESS/FINISHED) a las
 * etiquetas visuales que usa el frontend. Reemplaza al `estadoBadge` que
 * vivía en frontend/src/data/torneos.js con keys legacy en español.
 */
export const ESTADO_BADGE: Record<string, EstadoBadge> = {
  SCHEDULED: {
    label: 'Próximamente',
    dot: 'bg-accent',
    color: 'text-gold',
  },
  IN_PROGRESS: {
    label: 'En curso',
    dot: 'bg-success',
    color: 'text-success',
  },
  FINISHED: {
    label: 'Finalizado',
    dot: 'bg-fg-muted',
    color: 'text-fg-muted',
  },
}

/** Fallback defensivo si llega un estado desconocido del backend. */
export function getEstadoBadge(estado?: string): EstadoBadge {
  return estado ? ESTADO_BADGE[estado] ?? ESTADO_BADGE.SCHEDULED : ESTADO_BADGE.SCHEDULED
}

function idsEqual(a: unknown, b: unknown): boolean {
  return a != null && b != null && String(a) === String(b)
}

function numberFrom(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function canPatchParticipants(match: EnfrentamientoVivo, event: BracketUpdateEvent): boolean {
  const p1Ok =
    event.personaje1Id == null ||
    match.personaje1?.id == null ||
    idsEqual(event.personaje1Id, match.personaje1.id)
  const p2Ok =
    event.personaje2Id == null ||
    match.personaje2?.id == null ||
    idsEqual(event.personaje2Id, match.personaje2.id)
  return p1Ok && p2Ok
}

function patchEnfrentamiento(
  match: EnfrentamientoVivo | null | undefined,
  event: BracketUpdateEvent,
): { match: EnfrentamientoVivo | null | undefined; matched: boolean } {
  if (!match || !idsEqual(match.id, event.enfrentamientoId) || !canPatchParticipants(match, event)) {
    return { match, matched: false }
  }

  const personaje1Votos = numberFrom(event.personaje1Votos, Number(match.personaje1Votos ?? 0))
  const personaje2Votos = numberFrom(event.personaje2Votos, Number(match.personaje2Votos ?? 0))
  const totalVotos = numberFrom(event.totalVotos, personaje1Votos + personaje2Votos)

  return {
    matched: true,
    match: {
      ...match,
      personaje1Votos,
      personaje2Votos,
      totalVotos,
    },
  }
}

export function applyBracketUpdateToTorneoDetalle<T extends TorneoDetalleMinimo | null | undefined>(
  torneo: T,
  event: BracketUpdateEvent | null | undefined,
): T {
  if (!torneo || !event || event.enfrentamientoId == null) return torneo

  let matched = false
  const nextEnfrentamientos = Array.isArray(torneo.enfrentamientos)
    ? torneo.enfrentamientos.map((match) => {
        const patched = patchEnfrentamiento(match, event)
        matched = matched || patched.matched
        return patched.match as EnfrentamientoVivo
      })
    : torneo.enfrentamientos

  const patchedCurrent = patchEnfrentamiento(torneo.currentMatch, event)
  matched = matched || patchedCurrent.matched

  if (!matched) return torneo
  return {
    ...torneo,
    enfrentamientos: nextEnfrentamientos,
    currentMatch: patchedCurrent.match ?? torneo.currentMatch,
  } as T
}

export function bumpTorneoResumenVotos<T extends Array<Record<string, unknown>> | null | undefined>(
  torneos: T,
  slug: string | undefined,
): T {
  if (!Array.isArray(torneos) || !slug) return torneos
  let matched = false
  const next = torneos.map((torneo) => {
    if (torneo?.slug !== slug) return torneo
    matched = true
    return {
      ...torneo,
      votosUltimos7Dias: Number(torneo.votosUltimos7Dias ?? 0) + 1,
    }
  })
  return matched ? (next as T) : torneos
}

/**
 * Hooks react-query para todas las lecturas/escrituras de torneos.
 * Aislados aquí para que las páginas no sepan ni de queryKeys ni de
 * cómo se invalida cada cosa. 1.
 */

/** Listado de torneos (TorneoResumenDto[]). 5 min stale, sin refetch en focus. */
export function useTorneos() {
  return useQuery({
    queryKey: queryKeys.torneos(),
    queryFn: endpoints.torneos,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Detalle de un torneo por slug (TorneoDetalleDto incluye `enfrentamientos`).
 *
 * Doble canal de updates:
 *   1. Polling 30s mientras el torneo está IN_PROGRESS (fallback si el WS
 *      no conecta — proxies corporativos, mobile en red mala, etc).
 *   2. WebSocket STOMP suscrito a /topic/torneo.{id}.bracket: cuando alguien
 *      vota, el server pushea un BracketUpdateEvent y aquí actualizamos solo
 *      los conteos del match afectado en cache local.
 *
 * El refetchInterval se ajusta solo viendo data.estado, así que un torneo
 * pasa automáticamente de "no polling" a "polling 30s" cuando admin lo
 * inicia, sin remontar el componente.
 */
export function useTorneoBySlug(slug?: string) {
  const queryClient = useQueryClient()
  const query = useQuery<TorneoDetalleMinimo | null>({
    queryKey: queryKeys.torneoBySlug(slug),
    queryFn: () => endpoints.torneoBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
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
    let patched = false
    queryClient.setQueryData<TorneoDetalleMinimo | null>(
      queryKeys.torneoBySlug(slug),
      (old) => {
        const next = applyBracketUpdateToTorneoDetalle(old, lastMessage)
        patched = next !== old
        return next
      },
    )
    if (!patched) {
      queryClient.invalidateQueries({ queryKey: queryKeys.torneoBySlug(slug) })
    }
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
export function useVotarEnfrentamiento(torneoSlug?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ enfrentamientoId, personajeGanadorId }: VotoEnfrentamientoPayload) =>
      endpoints.votar(enfrentamientoId, personajeGanadorId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.torneos(), (old) =>
        bumpTorneoResumenVotos(old as Array<Record<string, unknown>> | undefined, torneoSlug),
      )
    },
  })
}
