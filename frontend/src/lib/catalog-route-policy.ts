const CRITICAL_CATALOG_BYPASS_EXACT = new Set([
  '/cartas',
  '/duel-live',
  '/ranking',
  '/torneos',
  '/votar',
])

// Rutas que NO necesitan el catálogo global de personajes (auth, legal,
// soporte, misiones…). App deja de primear el catálogo en ellas para que la
// carga fría solo haga /api/auth/refresh.
//
// INVARIANTE (no romper): estas rutas deben renderizarse DIRECTAS en App, nunca
// con catalogAware()/RequireCatalog. Si una ruta es a la vez gated (RequireCatalog)
// y aparece aquí, shouldPrimeCatalogFromApp devolvería false → el catálogo
// quedaría disabled → RequireCatalog bloquearía el render PARA SIEMPRE. Al añadir
// una ruta aquí, confirma en App.jsx que va como <Route element={<X/>}/> y no como
// catalogAware(<X/>).
const CATALOG_INDEPENDENT_EXACT = new Set([
  '/api-docs',
  '/apoya',
  '/auth/callback',
  '/como-funciona',
  '/dmca',
  '/faq',
  '/forgot-password',
  '/glossary',
  '/glosario',
  '/juegos/anime',
  '/login',
  '/metodologia-elo',
  '/mi-ranking',
  '/mision-diaria',
  '/misiones',
  '/newsletter/confirmar',
  '/privacy',
  '/privacidad',
  '/register',
  '/reset-password',
  '/status',
  '/terms',
  '/terminos',
  '/verify',
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

/**
 * ¿Debe App montar el catálogo global en esta ruta? True solo cuando la ruta
 * lo necesita: gatea por el catálogo (no es una ruta crítica que carga su
 * propia data) y NO está en la lista de rutas independientes (auth/legal/…).
 * Evita que la carga fría de /login, /cartas, etc. arrastre el catálogo entero.
 * Ver la INVARIANTE en CATALOG_INDEPENDENT_EXACT antes de tocar los sets.
 */
export function shouldPrimeCatalogFromApp(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname)
  return shouldGateCatalogRoute(normalized) && !CATALOG_INDEPENDENT_EXACT.has(normalized)
}
