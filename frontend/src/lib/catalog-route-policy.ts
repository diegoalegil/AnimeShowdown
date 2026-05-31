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
