const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g', '3g'])
const MAX_IDLE_WARMUP_ROUTES = 3

const WARMUP_ROUTES_BY_CONTEXT = [
  {
    test: (pathname) => pathname === '/',
    routes: ['/votar', '/ranking', '/torneos'],
  },
  {
    test: (pathname) => pathname === '/votar',
    routes: ['/ranking', '/personajes'],
  },
  {
    test: (pathname) => pathname === '/ranking',
    routes: ['/votar', '/personajes'],
  },
  {
    test: (pathname) => pathname === '/torneos',
    routes: ['/votar', '/ranking'],
  },
  {
    test: (pathname) => pathname === '/games',
    routes: ['/games/shadow-guess', '/games/anime-reveal'],
  },
]

export function canWarmupRoutes({
  connection = globalThis.navigator?.connection,
  deviceMemory = globalThis.navigator?.deviceMemory,
  hardwareConcurrency = globalThis.navigator?.hardwareConcurrency,
  visibilityState = globalThis.document?.visibilityState,
  coarsePointer = globalThis.matchMedia?.('(pointer: coarse)')?.matches ?? false,
} = {}) {
  if (visibilityState === 'hidden') return false
  // Móvil/táctil (puntero grueso): prewarmear rutas en idle compite con el
  // scroll y la descarga de imágenes del primer viewport. En móvil pesa más una
  // primera pintura/scroll fluido que adelantar transiciones de ruta.
  if (coarsePointer) return false
  if (connection?.saveData) return false

  const effectiveType = String(connection?.effectiveType ?? '').toLowerCase()
  if (SLOW_CONNECTION_TYPES.has(effectiveType)) return false
  if (Number.isFinite(connection?.downlink) && connection.downlink < 2) return false
  if (Number.isFinite(deviceMemory) && deviceMemory <= 2) return false
  if (Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 2) return false

  return true
}

export function idleWarmupRoutesFor(pathname) {
  const match = WARMUP_ROUTES_BY_CONTEXT.find((entry) => entry.test(pathname))
  return (match?.routes ?? []).slice(0, MAX_IDLE_WARMUP_ROUTES)
}
