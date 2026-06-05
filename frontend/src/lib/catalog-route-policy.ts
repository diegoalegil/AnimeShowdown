const CRITICAL_CATALOG_BYPASS_EXACT = new Set([
  '/duel-live',
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

// Rutas que NO muestran imágenes/datos de personaje (auth/legal) y cuyo chrome
// global (Header + FooterSlim) es catalog-independent. En ellas NO cebamos el
// catálogo global (~170KB) para no competir con la carga inicial — el fetch
// ocurre al entrar en la primera ruta que sí lo necesita. Conservador a
// propósito: cualquier ruta de contenido sigue cebándolo.
const CATALOG_FREE_EXACT = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/privacidad',
  '/terminos',
  '/faq',
])

export function shouldPrimeCatalog(pathname: string | null | undefined): boolean {
  return !CATALOG_FREE_EXACT.has(normalizePathname(pathname))
}
