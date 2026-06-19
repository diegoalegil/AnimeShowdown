import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * Hooks para predicciones de bracket.
 *
 * - useMisPredicciones(torneoId): lista de mis predicciones del torneo,
 *   solo se activa si hay user logueado. Para anónimos devuelve [].
 * - useAplicarPrediccion(torneoId): mutation que invalida la query de
 *   "mis predicciones" tras éxito. El backend ya hace INSERT o UPDATE
 *   automáticamente según UNIQUE constraint.
 * - useLeaderboardPredicciones({dias, limit}): top predictores. Público.
 */

function getUserCacheKey(user) {
  if (user?.id != null) return `user:${user.id}`
  if (user?.username) return `username:${user.username}`
  return 'anon'
}

function buildMiasKey(torneoId, userKey) {
  return ['predicciones', 'mias', String(torneoId), userKey]
}

function samePredictionScope(a, b) {
  if (!a || !b) return false
  if (a.id != null && b.id != null) return String(a.id) === String(b.id)
  if (a.tipo === 'CAMPEON' && b.tipo === 'CAMPEON') {
    return String(a.torneoId ?? '') === String(b.torneoId ?? '')
  }
  if (a.enfrentamientoId != null && b.enfrentamientoId != null) {
    return String(a.enfrentamientoId) === String(b.enfrentamientoId)
  }
  return false
}

export function mergePrediccionEnLista(predicciones, prediccion) {
  if (!prediccion) return predicciones
  if (!Array.isArray(predicciones)) return [prediccion]

  const index = predicciones.findIndex((item) => samePredictionScope(item, prediccion))
  if (index === -1) return [...predicciones, prediccion]

  const next = [...predicciones]
  next[index] = {
    ...next[index],
    ...prediccion,
  }
  return next
}

export function useMisPredicciones(torneoId) {
  const { user } = useAuth()
  const userKey = getUserCacheKey(user)
  return useQuery({
    queryKey: buildMiasKey(torneoId, userKey),
    queryFn: () => endpoints.misPredicciones(torneoId),
    enabled: Boolean(torneoId) && Boolean(user),
    staleTime: 30_000,
  })
}

export function useAplicarPrediccion(torneoId) {
  const { user } = useAuth()
  const userKey = getUserCacheKey(user)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ enfrentamientoId, personajePredichoId }) =>
      endpoints.aplicarPrediccion({ enfrentamientoId, personajePredichoId }),
    onSuccess: (prediccion) => {
      queryClient.setQueryData(
        buildMiasKey(torneoId, userKey),
        (old) => mergePrediccionEnLista(old, prediccion),
      )
      queryClient.invalidateQueries({ queryKey: buildMiasKey(torneoId, userKey) })
    },
  })
}

export function useAplicarPrediccionCampeon(torneoId) {
  const { user } = useAuth()
  const userKey = getUserCacheKey(user)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ personajePredichoId }) =>
      endpoints.aplicarPrediccionCampeon({ torneoId, personajePredichoId }),
    onSuccess: (prediccion) => {
      queryClient.setQueryData(
        buildMiasKey(torneoId, userKey),
        (old) => mergePrediccionEnLista(old, prediccion),
      )
      queryClient.invalidateQueries({ queryKey: buildMiasKey(torneoId, userKey) })
      // Por prefijo (sin el limit): invalida el leaderboard del torneo sea cual
      // sea el limit del consumidor; antes el literal 10 dejaba fuera otros.
      queryClient.invalidateQueries({
        queryKey: ['predicciones', 'leaderboard', 'torneo', String(torneoId)],
      })
    },
  })
}

export function useLeaderboardPredicciones({ dias = 30, limit = 10 } = {}) {
  return useQuery({
    queryKey: ['predicciones', 'leaderboard', dias, limit],
    queryFn: () => endpoints.leaderboardPredicciones({ dias, limit }),
    staleTime: 5 * 60 * 1000, // 5 min: el top no cambia tan rápido
  })
}

export function useLeaderboardPrediccionesTorneo({ torneoId, limit = 10 } = {}) {
  return useQuery({
    queryKey: ['predicciones', 'leaderboard', 'torneo', String(torneoId), limit],
    queryFn: () => endpoints.leaderboardPrediccionesTorneo({ torneoId, limit }),
    enabled: Boolean(torneoId),
    staleTime: 5 * 60 * 1000,
  })
}
