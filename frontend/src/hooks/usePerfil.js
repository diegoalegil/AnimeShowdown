import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * Hooks de perfil del usuario autenticado.
 *
 * Todos requieren user logueado — gate por user del AuthContext para no
 * disparar requests 403 cuando no hay sesión.
 */

export function usePerfilStats({ enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'stats'],
    queryFn: endpoints.perfilStats,
    enabled: enabled && Boolean(user),
    staleTime: 60_000,
  })
}

export function usePerfilTop({ limit = 5, enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'top', limit],
    queryFn: () => endpoints.perfilTop({ limit }),
    enabled: enabled && Boolean(user),
    staleTime: 60_000,
  })
}

/**
 * Feed combinado de actividad reciente. Devuelve un array
 * de items {tipo, fecha, payload}. staleTime corto (15s) porque puede
 * cambiar a cada voto/desbloqueo y queremos refresco rápido al volver
 * al tab Resumen.
 */
export function usePerfilActividad({ limit = 20, enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'actividad', limit],
    queryFn: () => endpoints.perfilActividad({ limit }),
    enabled: enabled && Boolean(user),
    staleTime: 15_000,
  })
}

/**
 * Stats de referral del usuario. Código + count
 * verificados. staleTime largo (5min) porque cambia despacio.
 */
export function usePerfilReferral({ enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'referral'],
    queryFn: endpoints.perfilReferral,
    enabled: enabled && Boolean(user),
    staleTime: 5 * 60_000,
  })
}

export function usePushPublicKey({ enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'push', 'public-key'],
    queryFn: endpoints.pushPublicKey,
    enabled: enabled && Boolean(user),
    staleTime: 10 * 60_000,
  })
}

export function usePushSubscribe() {
  return useMutation({
    mutationFn: ({ endpoint, keys }) =>
      endpoints.pushSubscribe({ endpoint, keys }),
  })
}

export function usePushUnsubscribe() {
  return useMutation({
    mutationFn: (endpoint) => endpoints.pushUnsubscribe(endpoint),
  })
}

/**
 * Perfil PÚBLICO de cualquier usuario por username.
 *
 * <p>No requiere auth — el endpoint backend es permitAll. Si el caller
 * está logueado, el token viaja igualmente y la respuesta incluye los
 * flags {@code siguiendo} y {@code esMismoUsuario} para que la UI decida
 * si pintar el botón Follow. staleTime corto (15s) porque los counts de
 * seguidores y stats cambian con frecuencia y son visibles al instante
 * tras follow/unfollow.
 */
export function usePerfilPublico(username) {
  return useQuery({
    queryKey: ['perfilPublico', username],
    queryFn: () => endpoints.perfilPublico(username),
    enabled: Boolean(username),
    staleTime: 15_000,
    retry: (count, err) => err?.status !== 404 && count < 2,
  })
}

/**
 * Toggle de seguir / dejar de seguir.
 *
 * <p>Devuelve un mutate que recibe {@code { usuarioId, siguiendo }} —
 * llama a {@code dejarDeSeguir} si {@code siguiendo} es true, a {@code seguir}
 * si es false. Tras éxito invalida la query del perfil para que counts y
 * flag refresquen sin recarga.
 */
export function useToggleSeguir(username) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ usuarioId, siguiendo }) =>
      siguiendo
        ? endpoints.dejarDeSeguir(usuarioId)
        : endpoints.seguir(usuarioId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfilPublico', username] })
    },
  })
}
