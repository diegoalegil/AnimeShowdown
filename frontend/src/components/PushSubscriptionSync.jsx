import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { endpoints } from '../lib/api'
import {
  soportaPush,
  getLocalSubscription,
  subscriptionPayload,
  urlBase64ToUint8Array,
} from '../lib/push'

const RESYNC_STORAGE_KEY = 'animeshowdown.push.resync.v1'
const RESYNC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000

function resyncReciente(endpoint) {
  try {
    const raw = localStorage.getItem(RESYNC_STORAGE_KEY)
    if (!raw) return false
    const { endpoint: previo, at } = JSON.parse(raw)
    return previo === endpoint && Date.now() - at < RESYNC_MIN_INTERVAL_MS
  } catch {
    return false
  }
}

function marcarResync(endpoint) {
  try {
    localStorage.setItem(RESYNC_STORAGE_KEY, JSON.stringify({ endpoint, at: Date.now() }))
  } catch {
    // Storage lleno o bloqueado: sin throttle, el coste es algún POST de más.
  }
}

/**
 * Side-effect-only (mismo patrón que BadgeUnlockListener): mantiene la
 * suscripción de web push del navegador atada al backend.
 *
 * <p>Dos vías:
 * - Al arrancar con sesión y permiso concedido, re-POSTea la suscripción
 *   local (máx. 1 vez/24h por endpoint). El subscribe del backend es un
 *   upsert por endpoint, así que esto re-ata suscripciones que el server
 *   podó tras un envío 404/410 o perdió por cualquier motivo.
 * - Cuando push-sw.js avisa de un pushsubscriptionchange (el navegador rotó
 *   la suscripción), re-registra al momento la nueva — o re-suscribe desde
 *   la página si el worker no pudo (la página sí puede pedir la VAPID key).
 */
function PushSubscriptionSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user || !soportaPush()) return undefined
    if (Notification.permission !== 'granted') return undefined

    let cancelled = false

    const resync = async ({ force = false } = {}) => {
      try {
        let subscription = await getLocalSubscription()
        if (!subscription && force) {
          const config = await endpoints.pushPublicKey()
          if (cancelled || !config?.enabled || !config.publicKey) return
          const registration = await navigator.serviceWorker.ready
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey),
          })
        }
        if (cancelled || !subscription) return
        if (!force && resyncReciente(subscription.endpoint)) return
        const payload = subscriptionPayload(subscription)
        await endpoints.pushSubscribe(payload)
        marcarResync(payload.endpoint)
      } catch {
        // Best-effort: sin red o sin SW activo; se reintenta en el próximo
        // arranque. Nunca debe romper el shell de la app.
      }
    }

    const onMessage = (event) => {
      if (event.data?.type !== 'push-subscription-change') return
      resync({ force: true })
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    resync()

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [user])

  return null
}

export default PushSubscriptionSync
