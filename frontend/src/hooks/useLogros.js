import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { endpoints } from '../lib/api.js'
import { useStompSubscription } from './useStompSubscription.js'

/**
 * Hooks de badges/logros (Plan v2 §4.2).
 *
 * - useCatalogoLogros: catálogo público inmutable. Cacheable long-term
 *   (staleTime infinito de facto — solo se invalida tras deploy).
 * - useMisLogros: catálogo + desbloqueadoEn por usuario. Se suscribe al
 *   user-queue WS para refetch cuando llegue una notif BADGE_DESBLOQUEADO
 *   (consistencia inmediata sin polling).
 */

export function useCatalogoLogros() {
  return useQuery({
    queryKey: ['logros', 'catalogo'],
    queryFn: endpoints.logros,
    staleTime: 1000 * 60 * 60, // 1h: catálogo es inmutable
  })
}

export function useMisLogros({ enabled = true } = {}) {
  const queryClient = useQueryClient()
  const queryKey = ['logros', 'mios']

  const query = useQuery({
    queryKey,
    queryFn: endpoints.misLogros,
    enabled,
  })

  // Refetch on WebSocket push de notificaciones — si el usuario desbloquea
  // un badge mientras está en /perfil, queremos que aparezca al instante
  // sin tener que recargar.
  const { lastMessage } = useStompSubscription(
    enabled ? '/user/queue/notificaciones' : null,
  )
  useEffect(() => {
    if (!lastMessage) return
    if (lastMessage?.tipo === 'BADGE_DESBLOQUEADO') {
      queryClient.invalidateQueries({ queryKey })
    }
  }, [lastMessage, queryClient])

  return query
}
