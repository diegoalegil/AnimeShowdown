import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

/**
 * B7 §2: feed de comunidad (actividad reciente de los usuarios que sigues).
 * Solo se ejecuta con sesión iniciada — el endpoint es autenticado. El
 * empty-state de logueado-sin-seguidos lo decide la flag `sigueAAlguien`
 * de la respuesta; el de no-logueado lo gestiona la página (CTA de captación).
 */
export function useFeed({ page = 0, size = 20 } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['feed', page, size],
    queryFn: () => endpoints.feed({ page, size }),
    enabled: Boolean(user),
    staleTime: 15_000,
  })
}
