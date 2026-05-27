// Cliente STOMP singleton sobre @stomp/stompjs.
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
//   - Los topics públicos conectan incluso sin JWT. Si hay JWT, viaja en
//     CONNECT para habilitar colas privadas /user/**.

import { Client } from '@stomp/stompjs'
import { API_BASE, getToken, onTokenChange } from './api'

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
      // Frame ERROR del broker — típicamente JWT inválido. Lo registramos
      // solo en dev y dejamos que reconectemos solos; si el JWT no es válido, el
      // siguiente intento también fallará hasta que el usuario re-login.
      if (import.meta.env.DEV) {
        console.warn('[stomp] error frame:', frame.headers?.message)
      }
      notifyConnected(false)
    },
    debug: () => {
      /* silencio en prod; rehabilitar para debug local */
    },
  })
  return c
}

// Cadena de deactivations. Antes el
// flag booleano isReconnecting no cubría dos reconnects consecutivos:
// reconnect A guardaba stale, marcaba isReconnecting=true, hacía await
// deactivate; reconnect B entraba MIENTRAS A esperaba, encontraba
// client=null+stale=null, no esperaba al deactivate de A y al final
// reseteaba isReconnecting=false antes de tiempo. Resultado:
// ensureConnected podía abrir un cliente nuevo mientras A seguía
// cerrando su socket. Ahora chain serializa todos los await
// deactivate; ensureConnected espera mientras haya cualquiera
// pendiente.
let deactivationPromise = null

export function ensureConnected() {
  if (deactivationPromise) return null
  if (client) return client
  client = createClient()
  client.activate()
  return client
}

export async function disconnect() {
  if (!client) return
  const stale = client
  client = null
  notifyConnected(false)
  // Await el deactivate y encadena en
  // deactivationPromise para que ensureConnected lo respete igual que
  // un reconnect. Antes era fire-and-forget y un subscribe inmediato
  // podía crear cliente nuevo antes de cerrar el viejo.
  const chained = deactivationPromise
    ? deactivationPromise.then(() => stale.deactivate()).catch(() => {})
    : stale.deactivate().catch(() => {})
  deactivationPromise = chained
  try {
    await chained
  } finally {
    if (deactivationPromise === chained) deactivationPromise = null
  }
}

// Reconectar cuando el token cambia (logout, login
// con otro usuario, refresh silencioso tras 401). Sin esto el WS singleton
// seguía conectado con el JWT viejo y las notificaciones del usuario nuevo
// iban a la cola del anterior. Se llama desde el listener registrado abajo.
//
// Además de deactivate el cliente,
// hay que LIMPIAR el activeListener y sub de cada canal para que
// attach() los trate como pendientes y re-cree listeners contra el cliente
// nuevo. Antes el guard `if (channel.activeListener) return` impedía la
// re-suscripción y el closure viejo apuntaba a un cliente destruido →
// notificaciones/brackets silenciosos hasta reload.
// client.deactivate() es async — devuelve
// Promise. Si llamamos tryAttachPending() inmediatamente, attach() crea
// un cliente nuevo MIENTRAS el viejo aún cierra su socket. Resultado: dos
// conexiones WS vivas durante 50-200ms en cada refresh/login rápido.
// Esperamos al deactivate antes de re-attach. Marcamos un counter para
// que reconnects superpuestos no se pisen.
let reconnectGeneration = 0
async function reconnect() {
  const gen = ++reconnectGeneration
  const stale = client
  client = null
  for (const channel of subscriptions.values()) {
    if (channel.activeListener) {
      connectedListeners.delete(channel.activeListener)
      channel.activeListener = null
    }
    channel.sub = null
  }
  // Encadena el deactivate del cliente
  // actual sobre cualquier deactivationPromise previa. ensureConnected
  // ve deactivationPromise != null y devuelve null hasta el final de
  // toda la cadena → cero solape entre cliente viejo y nuevo aunque
  // lleguen N reconnects seguidos.
  const myDeact = stale
    ? (deactivationPromise
        ? deactivationPromise.then(() => stale.deactivate()).catch(() => {})
        : stale.deactivate().catch(() => {}))
    : (deactivationPromise || Promise.resolve())
  deactivationPromise = myDeact
  try {
    await myDeact
  } finally {
    if (deactivationPromise === myDeact) deactivationPromise = null
  }
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

// Canales abiertos por destination (pendientes y activos). Una destination
// STOMP se suscribe una sola vez al broker y fan-out local reparte el payload
// entre todos los hooks. Esto evita que dos consumidores de una queue privada
// (/user/queue/...) compitan entre si y uno se quede sin mensaje.
const subscriptions = new Map()

function parseMessageBody(message) {
  try {
    return message.body ? JSON.parse(message.body) : null
  } catch {
    return message.body
  }
}

function notifyChannel(channel, payload) {
  for (const listener of channel.listeners) {
    try {
      listener.onMessage(payload)
    } catch {
      /* listener errors aren't ours */
    }
  }
}

function getChannel(destination) {
  let channel = subscriptions.get(destination)
  if (!channel) {
    channel = {
      destination,
      listeners: new Set(),
      sub: null,
      activeListener: null,
    }
    subscriptions.set(destination, channel)
  }
  return channel
}

function detachChannel(channel) {
  if (channel.sub) {
    try {
      channel.sub.unsubscribe()
    } catch {
      /* ignore */
    }
    channel.sub = null
  }
  if (channel.activeListener) {
    connectedListeners.delete(channel.activeListener)
    channel.activeListener = null
  }
  subscriptions.delete(channel.destination)
}

function attach(channel) {
  const c = ensureConnected()
  if (!c) return // No hay token todavía — queda pendiente.
  if (channel.activeListener) return // Ya estaba enganchado.

  const doSubscribe = () => {
    if (!c.connected) return
    channel.sub = c.subscribe(channel.destination, (message) => {
      notifyChannel(channel, parseMessageBody(message))
    })
  }
  doSubscribe()
  const onConnect = (connected) => {
    if (connected) {
      // Defensivo: si seguía referenciando una vieja, unsubscribe antes.
      if (channel.sub) {
        try {
          channel.sub.unsubscribe()
        } catch {
          /* ignore */
        }
        channel.sub = null
      }
      doSubscribe()
    } else {
      // El WS cayó: olvida la sub local para que el próximo reconnect re-suscriba.
      channel.sub = null
    }
  }
  channel.activeListener = onConnect
  connectedListeners.add(onConnect)
}

/**
 * Intenta enganchar todas las subscriptions pendientes. Llamar desde
 * AuthContext cuando setToken haya recibido un token nuevo — los hooks
 * que se montaron sin token (bootstrap optimista desde localStorage)
 * recuperan sus subscripciones sin remount.
 */
export function tryAttachPending() {
  for (const channel of subscriptions.values()) attach(channel)
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
  // Registramos siempre la subscription, incluso
  // sin token. Antes returnabamos no-op silencioso y el hook quedaba
  // sordo — en bootstrap el user optimista de localStorage hacía que los
  // hooks llamaran subscribe ANTES de que refreshSession trajera el JWT,
  // y sus suscripciones se perdían hasta remount. Ahora attach se
  // reintenta vía tryAttachPending tras setToken.
  const channel = getChannel(destination)
  const listener = { onMessage }
  channel.listeners.add(listener)
  attach(channel)
  return () => {
    channel.listeners.delete(listener)
    if (channel.listeners.size === 0) detachChannel(channel)
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
