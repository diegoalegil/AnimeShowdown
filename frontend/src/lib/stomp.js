// Cliente STOMP singleton sobre @stomp/stompjs (Plan v2 §2.13).
//
// Una sola conexión WS por pestaña de navegador, compartida entre todos los
// hooks que necesitan subscribirse a topics distintos. Cuando el usuario
// hace login (o refresca el JWT), reconectamos para que el handshake
// CONNECT envíe el header Authorization actualizado.
//
// API pública:
//   ensureConnected()           — asegura la conexión (idempotente).
//   subscribe(destination, cb)  — devuelve función unsubscribe.
//   disconnect()                — cierra la conexión activa.
//   isConnected()               — bool consultable desde React.
//
// Manejo de errores:
//   - Si WS no es soportado o el backend lo rechaza, el cliente intenta
//     reconectar cada 5s indefinidamente. El consumidor (hooks de UI)
//     debe combinarlo con un fallback al polling REST tras N segundos.
//   - Si el JWT expira, el frame CONNECT vuelve con ERROR; el cliente
//     se desconecta y los hooks notarán el cambio vía isConnected().

import { Client } from '@stomp/stompjs'
import { getToken } from './api'

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'https://api.animeshowdown.dev'

// Convierte el API base HTTP en URL WS: https → wss, http → ws.
const BROKER_URL = API_BASE.replace(/^http/, 'ws') + '/ws'

let client = null
let connectedListeners = new Set() // Set<(connected: boolean) => void>

function notifyConnected(value) {
  for (const fn of connectedListeners) {
    try {
      fn(value)
    } catch {
      /* listener errors aren't ours */
    }
  }
}

function createClient() {
  const c = new Client({
    brokerURL: BROKER_URL,
    // Refrescar headers en cada CONNECT — si el JWT cambió entre intentos
    // de reconexión, esta función se vuelve a llamar y agarra el nuevo.
    beforeConnect: () => {
      const token = getToken()
      c.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    },
    // Reconnect cada 5s. Si el backend está caído seguimos intentando sin
    // colapsar el cliente.
    reconnectDelay: 5000,
    heartbeatIncoming: 25000,
    heartbeatOutgoing: 25000,
    onConnect: () => notifyConnected(true),
    onWebSocketClose: () => notifyConnected(false),
    onStompError: (frame) => {
      // Frame ERROR del broker — típicamente JWT inválido. Lo logueamos
      // y dejamos que reconectemos solos; si el JWT no es válido, el
      // siguiente intento también fallará hasta que el usuario re-login.
      console.warn('[stomp] error frame:', frame.headers?.message)
      notifyConnected(false)
    },
    debug: () => {
      /* silencio en prod; rehabilitar para debug local */
    },
  })
  return c
}

export function ensureConnected() {
  if (client) return client
  client = createClient()
  client.activate()
  return client
}

export function disconnect() {
  if (!client) return
  client.deactivate()
  client = null
  notifyConnected(false)
}

export function isConnected() {
  return !!client && client.connected
}

/**
 * Subscribe a un destination STOMP. Devuelve un cleanup que hace unsubscribe
 * y, si no quedan más subscripciones, desactiva el client (no estrictamente
 * necesario en SPA pero deja la app limpia).
 *
 * @param {string} destination ej. '/topic/torneo.42.bracket' o
 *                             '/user/queue/notificaciones'.
 * @param {(payload: any) => void} onMessage callback que recibe el body
 *                                 ya parseado de JSON.
 * @returns {() => void} cleanup
 */
export function subscribe(destination, onMessage) {
  const c = ensureConnected()
  let sub = null

  // Si todavía no está conectado, dejamos el subscribe para el callback
  // onConnect. STOMP no acepta subscribes antes del CONNECT confirmado.
  const doSubscribe = () => {
    if (!c.connected) return
    sub = c.subscribe(destination, (message) => {
      try {
        const body = message.body ? JSON.parse(message.body) : null
        onMessage(body)
      } catch {
        onMessage(message.body)
      }
    })
  }

  doSubscribe()
  // Si no había conexión en el momento de llamar, lo retomamos cuando
  // se conecte.
  const onConnect = (connected) => {
    if (connected && !sub) doSubscribe()
  }
  connectedListeners.add(onConnect)

  return () => {
    if (sub) {
      try {
        sub.unsubscribe()
      } catch {
        /* ignore */
      }
    }
    connectedListeners.delete(onConnect)
  }
}

/** Listener global del estado de conexión, devuelve cleanup. */
export function onConnectionChange(fn) {
  connectedListeners.add(fn)
  // Notify inmediato del estado actual para que el caller no espere al
  // próximo evento si ya estamos conectados o desconectados.
  try {
    fn(isConnected())
  } catch {
    /* listener errors aren't ours */
  }
  return () => connectedListeners.delete(fn)
}
