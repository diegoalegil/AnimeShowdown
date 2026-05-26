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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildMiasKey(torneoId, userKey) })
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
