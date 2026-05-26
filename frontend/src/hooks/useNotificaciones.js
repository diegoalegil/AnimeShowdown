import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { useStompSubscription } from './useStompSubscription.js'

/**
 * Hooks de notificaciones in-app.
 *
 * - Listado paginado + suscripción WS a /user/queue/notificaciones que
 *   invalida la query al llegar un push.
 * - Count de no leídas (badge del header).
 * - Mutations marcarLeida + marcarTodasLeidas con invalidación automática.
 */

const KEY_LIST_BASE = ['notificaciones']
const KEY_UNREAD = ['notificaciones', 'unread-count']

function useNotificacionesPushInvalidation(enabled) {
  const queryClient = useQueryClient()
  const { lastMessage } = useStompSubscription(
    enabled ? '/user/queue/notificaciones' : null,
  )

  useEffect(() => {
    if (!lastMessage) return
    queryClient.invalidateQueries({ queryKey: KEY_LIST_BASE })
  }, [lastMessage, queryClient])
}

export function useNotificaciones({
  soloNoLeidas = false,
  enabled = true,
  size = 20,
  subscribeToPush = true,
} = {}) {
  const queryKey = [...KEY_LIST_BASE, { soloNoLeidas, size }]

  const query = useQuery({
    queryKey,
    queryFn: () => endpoints.notificaciones({ soloNoLeidas, page: 0, size }),
    enabled,
  })

  // Suscripción WS: cuando llega un push, invalidamos tanto la lista como
  // el unread-count para que ambos se refresquen.
  useNotificacionesPushInvalidation(enabled && subscribeToPush)

  return query
}

export function useUnreadCount({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: KEY_UNREAD,
    queryFn: endpoints.notificacionesUnreadCount,
    enabled,
    // Refresh manual no hace falta — el WS push invalida también el count
    // (KEY_LIST_BASE es prefijo). Polling lento como cinturón de seguridad
    // en caso de que un usuario tenga el WS roto y no notar las notifs.
    refetchInterval: 60_000,
  })
  useNotificacionesPushInvalidation(enabled)
  return query
}

export function useMarcarLeida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => endpoints.notificacionMarcarLeida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY_LIST_BASE })
    },
  })
}

export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => endpoints.notificacionesMarcarTodasLeidas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY_LIST_BASE })
    },
  })
}
