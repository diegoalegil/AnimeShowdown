import { useEffect, useState } from 'react'
import { subscribe, onConnectionChange } from '../lib/stomp'

/**
 * Hook que se suscribe a un destination STOMP y devuelve el último mensaje
 * recibido más un flag de estado de conexión (Plan v2 §2.13).
 *
 * Uso típico:
 *   const { lastMessage, connected } = useStompSubscription(
 *     `/topic/torneo.${torneoId}.bracket`
 *   )
 *
 * Si `destination` es null o el usuario no tiene token, no se conecta —
 * útil para suscripciones condicionales (p.ej. solo cuando user existe).
 */
export function useStompSubscription(destination, { enabled = true } = {}) {
  const [lastMessage, setLastMessage] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !destination) return
    const cleanupSub = subscribe(destination, setLastMessage)
    const cleanupConn = onConnectionChange(setConnected)
    return () => {
      cleanupSub()
      cleanupConn()
    }
  }, [destination, enabled])

  return { lastMessage, connected }
}
