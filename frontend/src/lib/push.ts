// Helpers de Web Push compartidos entre la card de ajustes
// (CardPushNotificaciones) y el resync global (PushSubscriptionSync).

/**
 * Forma mínima de PushSubscription que necesita subscriptionPayload — permite
 * testear con objetos planos sin fabricar una PushSubscription real.
 */
export interface PushSubscriptionLike {
  endpoint: string
  toJSON(): { keys?: Record<string, string> }
  getKey(name: 'p256dh' | 'auth'): ArrayBuffer | null
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function soportaPush(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function arrayBufferToBase64Url(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export async function getLocalSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.pushManager) return null
  return registration.pushManager.getSubscription()
}

export function subscriptionPayload(subscription: PushSubscriptionLike): PushSubscriptionPayload {
  const json = subscription.toJSON()
  const p256dhKey = subscription.getKey('p256dh')
  const authKey = subscription.getKey('auth')
  const p256dh = json.keys?.p256dh
    || (p256dhKey ? arrayBufferToBase64Url(p256dhKey) : '')
  const auth = json.keys?.auth
    || (authKey ? arrayBufferToBase64Url(authKey) : '')

  if (!subscription.endpoint || !p256dh || !auth) {
    throw new Error('La suscripcion del navegador esta incompleta.')
  }

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
  }
}
