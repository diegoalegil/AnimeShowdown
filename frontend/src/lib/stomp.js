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
import { getToken, onTokenChange } from './api'

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

// Audit P2 (2026-05-17, 4ª iter): flag que bloquea ensureConnected
// mientras hay un deactivate() en curso. Sin esto, AuthContext o
// cualquier subscribe() entre client=null y await deactivate podían
// crear un cliente nuevo antes de que el viejo terminara de cerrar
// su socket — dos WS vivos durante 50-200ms en cada cambio de token.
let isReconnecting = false

export function ensureConnected() {
  if (isReconnecting) return null
  if (client) return client
  // Audit P2 (2026-05-17): el handshake HTTP /ws es público pero el frame
  // CONNECT requiere JWT (WebSocketConfig.JwtAuthChannelInterceptor). Sin
  // token, intentar conectar dispara un loop de error frame + reconnect
  // cada 5s en páginas públicas — log noise y peticiones inútiles. Si no
  // hay JWT, devolvemos null y los subscribe quedan no-op silencioso.
  // Cuando el usuario haga login, el siguiente subscribe (o llamada
  // explícita a ensureConnected) sí activa el cliente.
  const token = getToken()
  if (!token) return null
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

// Audit P1 (2026-05-17): reconectar cuando el token cambia (logout, login
// con otro usuario, refresh silencioso tras 401). Sin esto el WS singleton
// seguía conectado con el JWT viejo y las notificaciones del usuario nuevo
// iban a la cola del anterior. Se llama desde el listener registrado abajo.
//
// Audit P1 (2026-05-17, segunda iteración): además de deactivate el cliente,
// hay que LIMPIAR el activeListener y sub de cada subscription para que
// attach() las trate como pendientes y re-cree listeners contra el cliente
// nuevo. Antes el guard `if (entry.activeListener) return` impedía la
// re-suscripción y el closure viejo apuntaba a un cliente destruido →
// notificaciones/brackets silenciosos hasta reload.
// Audit P3 (2026-05-17, 3ª iter): client.deactivate() es async — devuelve
// Promise. Si llamamos tryAttachPending() inmediatamente, attach() crea
// un cliente nuevo MIENTRAS el viejo aún cierra su socket. Resultado: dos
// conexiones WS vivas durante 50-200ms en cada refresh/login rápido.
// Esperamos al deactivate antes de re-attach. Marcamos un counter para
// que reconnects superpuestos no se pisen.
let reconnectGeneration = 0
async function reconnect() {
  const gen = ++reconnectGeneration
  const stale = client
  // Marca null inmediato + flag de reconnect en curso para que
  // ensureConnected() devuelva null mientras esperamos a deactivate.
  // Sin el flag, AuthContext.tryAttachPending o cualquier subscribe()
  // entre medias creaba un cliente nuevo MIENTRAS el viejo aún cerraba
  // su socket — dos WS vivos brevemente.
  client = null
  isReconnecting = true
  for (const entry of subscriptions) {
    if (entry.activeListener) {
      connectedListeners.delete(entry.activeListener)
      entry.activeListener = null
    }
    entry.sub = null
  }
  if (stale) {
    try {
      await stale.deactivate()
    } catch {
      /* deactivate puede rechazar si el socket murió antes — ignoramos. */
    }
  }
  isReconnecting = false
  // Si entre deactivate y tryAttach apareció otro reconnect (e.g. dos
  // setToken en rápida sucesión), abortamos: ese reconnect ya hará
  // su propio tryAttach con el token más reciente.
  if (gen !== reconnectGeneration) return
  tryAttachPending()
}

// Subscriber global: cualquier cambio de token reinicia el cliente WS.
// Pasamos por una arrow porque onTokenChange espera función sync.
onTokenChange(() => { reconnect() })

export function isConnected() {
  return !!client && client.connected
}

// Subscriptions abiertas (pendientes y activas). Cuando hay token y cliente,
// cada entry tiene su sub real y su listener. Cuando no, queda pendiente y
// se re-engancha vía tryAttachPending() (llamado al activar el cliente).
const subscriptions = new Set()

function attach(entry) {
  const c = ensureConnected()
  if (!c) return // No hay token todavía — queda pendiente.
  if (entry.activeListener) return // Ya estaba enganchado.

  const doSubscribe = () => {
    if (!c.connected) return
    entry.sub = c.subscribe(entry.destination, (message) => {
      try {
        const body = message.body ? JSON.parse(message.body) : null
        entry.onMessage(body)
      } catch {
        entry.onMessage(message.body)
      }
    })
  }
  doSubscribe()
  const onConnect = (connected) => {
    if (connected) {
      // Defensivo: si seguía referenciando una vieja, unsubscribe antes.
      if (entry.sub) {
        try {
          entry.sub.unsubscribe()
        } catch {
          /* ignore */
        }
        entry.sub = null
      }
      doSubscribe()
    } else {
      // El WS cayó: olvida la sub local para que el próximo reconnect re-suscriba.
      entry.sub = null
    }
  }
  entry.activeListener = onConnect
  connectedListeners.add(onConnect)
}

/**
 * Intenta enganchar todas las subscriptions pendientes. Llamar desde
 * AuthContext cuando setToken haya recibido un token nuevo — los hooks
 * que se montaron sin token (bootstrap optimista desde localStorage)
 * recuperan sus subscripciones sin remount.
 */
export function tryAttachPending() {
  for (const entry of subscriptions) attach(entry)
}

/**
 * Subscribe a un destination STOMP. Devuelve un cleanup que hace unsubscribe.
 *
 * @param {string} destination ej. '/topic/torneo.42.bracket' o
 *                             '/user/queue/notificaciones'.
 * @param {(payload: any) => void} onMessage callback que recibe el body
 *                                 ya parseado de JSON.
 * @returns {() => void} cleanup
 */
export function subscribe(destination, onMessage) {
  // Audit P2 (2026-05-17): registramos siempre la subscription, incluso
  // sin token. Antes returnabamos no-op silencioso y el hook quedaba
  // sordo — en bootstrap el user optimista de localStorage hacía que los
  // hooks llamaran subscribe ANTES de que refreshSession trajera el JWT,
  // y sus suscripciones se perdían hasta remount. Ahora attach se
  // reintenta vía tryAttachPending tras setToken.
  const entry = { destination, onMessage, sub: null, activeListener: null }
  subscriptions.add(entry)
  attach(entry)
  return () => {
    if (entry.sub) {
      try {
        entry.sub.unsubscribe()
      } catch {
        /* ignore */
      }
    }
    if (entry.activeListener) {
      connectedListeners.delete(entry.activeListener)
    }
    subscriptions.delete(entry)
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
