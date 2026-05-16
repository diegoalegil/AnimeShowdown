import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * Hooks de perfil del usuario autenticado (Plan v2 §4.1).
 *
 * Todos requieren user logueado — gate por user del AuthContext para no
 * disparar requests 403 cuando no hay sesión.
 */

export function usePerfilStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'stats'],
    queryFn: endpoints.perfilStats,
    enabled: Boolean(user),
    staleTime: 60_000,
  })
}

export function usePerfilHistorial({ page = 0, size = 50 } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'historial', page, size],
    queryFn: () => endpoints.perfilHistorialVotos({ page, size }),
    enabled: Boolean(user),
    staleTime: 30_000,
  })
}

export function usePerfilTop({ limit = 5 } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', 'top', limit],
    queryFn: () => endpoints.perfilTop({ limit }),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
}
