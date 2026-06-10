self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    try {
      data = JSON.parse(event.data?.text() || '{}')
    } catch {
      data = {}
    }
  }

  const title = data.title || 'AnimeShowdown'
  const options = {
    body: data.body || 'Tienes una nueva notificacion.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'animeshowdown',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('pushsubscriptionchange', (event) => {
  // El navegador rotó/expiró la suscripción: la antigua que conoce el server
  // está muerta. Re-suscribimos aquí con la misma applicationServerKey y
  // delegamos el re-registro en cualquier pestaña abierta (el worker no tiene
  // credenciales para llamar al API). Si no hay pestañas, el resync al abrir
  // la app (PushSubscriptionSync) re-registra la suscripción local nueva.
  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey

  const resuscribir = async () => {
    if (applicationServerKey) {
      try {
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      } catch {
        // Sin permiso o sin key válida: lo recogerá el resync de la app.
      }
    }
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clientList) {
      client.postMessage({ type: 'push-subscription-change' })
    }
  }

  event.waitUntil(resuscribir())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data?.url || '/'
  const targetUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client && client.url.startsWith(self.location.origin)) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
        return undefined
      }),
  )
})
