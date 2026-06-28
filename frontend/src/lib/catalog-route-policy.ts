const CRITICAL_CATALOG_BYPASS_EXACT = new Set([
  '/duel-live',
  // ELO Duel es server-driven: pide su propia ronda al backend y no lee el
  // catálogo global. Gatearlo lo rompía si el catálogo fallaba pese a no usarlo;
  // la página ya trae sus propios estados de carga/indisponible.
  '/games/elo-duel',
  '/ranking',
  '/torneos',
  '/votar',
])

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return '/'
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

export function bypassCatalogGateForPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname)
  if (CRITICAL_CATALOG_BYPASS_EXACT.has(normalized)) return true
  return normalized.startsWith('/torneos/') && normalized !== '/torneos/crear'
}

export function shouldGateCatalogRoute(pathname: string | null | undefined): boolean {
  return !bypassCatalogGateForPath(pathname)
}

// Rutas que NO necesitan el catálogo global (~170KB) primado. En ellas NO lo
// cebamos para no competir con la carga inicial — el fetch ocurre al entrar en
// la primera ruta que sí lo necesita. Conservador: cualquier ruta de contenido
// que use el catálogo sigue cebándolo.
const CATALOG_FREE_EXACT = new Set([
  // Auth/legal: chrome global (Header + FooterSlim) catalog-independent.
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/privacidad',
  '/terminos',
  '/faq',
  // /cartas pinta la colección desde DTOs de carta (slug/nombre/colorDominante)
  // e imágenes por slug vía /img; NO lee el catálogo global (verificado: ningún
  // componente de cartas usa el snapshot). Aterrizar directo en /cartas
  // (link/notificación) ya no arrastra ese fetch.
  '/cartas',
])

export function shouldPrimeCatalog(pathname: string | null | undefined): boolean {
  return !CATALOG_FREE_EXACT.has(normalizePathname(pathname))
}
