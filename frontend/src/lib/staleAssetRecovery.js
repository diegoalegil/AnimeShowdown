const RELOAD_KEY = 'animeshowdown:stale-asset-reload-at'
const RELOAD_COOLDOWN_MS = 30 * 60 * 1000

const STALE_ASSET_PATTERNS = [
  'valid javascript mime type',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'chunkloaderror',
  'loading chunk',
]

function messageFrom(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value.message) return String(value.message)
  if (value.reason) return messageFrom(value.reason)
  if (value.error) return messageFrom(value.error)
  return String(value)
}

function isRuntimeAssetUrl(value) {
  if (!value || typeof window === 'undefined') return false

  try {
    const url = new URL(value, window.location.href)
    if (url.origin !== window.location.origin) return false

    return (
      url.pathname.startsWith('/assets/') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/registerSW.js'
    )
  } catch {
    return false
  }
}

export function isStaleAssetError(error) {
  const message = messageFrom(error).toLowerCase()
  if (!message) return false

  return STALE_ASSET_PATTERNS.some((pattern) => message.includes(pattern))
}

function canReloadNow() {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0)
    return !lastReloadAt || Date.now() - lastReloadAt > RELOAD_COOLDOWN_MS
  } catch {
    return true
  }
}

function markReloadAttempted() {
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Storage privado/bloqueado: seguimos con la recarga sin persistir marca.
  }
}

async function clearRuntimeCaches() {
  const cacheApi = window.caches
  if (cacheApi?.keys) {
    try {
      const names = await cacheApi.keys()
      // Borramos TODAS las caches del SW, no solo chunks-js/precache/workbox.
      // El bug recurrente (Audit P1 2026-05-20) lo causaba un index.html
      // stale precacheado por workbox; si filtramos por nombre dejamos otras
      // caches que pueden estar igual de corruptas. Es agresivo pero garantiza
      // que tras el reload el SW empiece limpio.
      await Promise.all(names.map((name) => cacheApi.delete(name)))
    } catch {
      // Si CacheStorage falla, recargar sigue siendo mejor que dejar la UI rota.
    }
  }

  if (navigator.serviceWorker?.getRegistrations) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      // unregister() en lugar de update(): si el SW activo tiene un bug
      // sirviendo HTML como JS, .update() solo hace fetch del sw.js nuevo
      // pero deja al viejo controlando los clientes hasta el siguiente ciclo
      // de navegacion. unregister + reload da el corte limpio.
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch {
      // No bloqueamos la recuperación por un unregister fallido del SW.
    }
  }
}

export function recoverFromStaleAssetError(error) {
  if (typeof window === 'undefined' || !isStaleAssetError(error)) return false
  if (!canReloadNow()) return false

  markReloadAttempted()

  clearRuntimeCaches().finally(() => {
    window.location.reload()
  })

  return true
}

export function installStaleAssetRecovery() {
  if (typeof window === 'undefined' || window.__AS_STALE_ASSET_RECOVERY__) return
  window.__AS_STALE_ASSET_RECOVERY__ = true

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target
      const assetUrl =
        target instanceof HTMLScriptElement || target instanceof HTMLLinkElement
          ? target.src || target.href
          : ''

      if (isRuntimeAssetUrl(assetUrl) || isStaleAssetError(event.error || event.message)) {
        recoverFromStaleAssetError(event.error || event.message || assetUrl)
      }
    },
    true,
  )

  window.addEventListener('unhandledrejection', (event) => {
    recoverFromStaleAssetError(event.reason)
  })
}
