import { QueryClient } from '@tanstack/react-query'

type QueryKeyPart = string | number | boolean | null | undefined
type QueryKey = QueryKeyPart[]

function normalizeSlugs(slugs: unknown): string {
  return (Array.isArray(slugs) ? slugs : [])
    .filter(Boolean)
    .map(String)
    .sort()
    .join(',')
}

// QueryClient global compartido entre App.jsx y tests. Lo exportamos como
// constante única (no factory) porque queremos UNA cache para toda la
// SPA — cambiar de página no debe perder el ranking ya cargado, ni el
// detalle de un torneo si vuelves a él.
//
// Defaults pensados para AnimeShowdown:
//  - staleTime 5 min: la mayoría de endpoints (personajes, ranking) son
//    casi inmutables; refetch al volver a focar la pestaña es ruido.
//  - gcTime 10 min: cuánto sobrevive el cache fuera de pantalla antes de
//    liberarse. Para no recargar al hacer back/forward de browser.
//  - retry 1: un fallo es una llamada de gracia, dos retries más es spam
//    contra Railway cold-start.
//  - refetchOnWindowFocus false: el polling explícito en TorneoDetailPage
// ya cubre el caso de torneos en vivo.
//    Refetch en focus añade hits innecesarios.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

/**
 * Convención de query keys: array `[recurso,...identificadores]`.
 * Funciones helper aquí para evitar typos y centralizar invalidaciones.
 */
export const queryKeys = {
  torneos: (): QueryKey => ['torneos'],
  torneoBySlug: (slug: string | undefined): QueryKey => ['torneos', 'slug', slug],
  torneoById: (id: string | number): QueryKey => ['torneos', 'id', id],
  // Mi roster / favoritos
  misFavoritos: (): QueryKey => ['favoritos', 'me'],
  favoritoSlug: (slug: string): QueryKey => ['favoritos', 'slug', slug],
  // Actividad reciente de votos
  votosPeriodoSlug: (slug: string, dias = 7): QueryKey => ['votos-periodo', 'slug', slug, dias],
  votosPeriodoBatch: (slugs: unknown[] = [], dias = 7): QueryKey => [
    'votos-periodo',
    'batch',
    normalizeSlugs(slugs),
    dias,
  ],
  // Cartas coleccionables
  coleccionResumen: (): QueryKey => ['cartas', 'resumen'],
  coleccionPagina: (rareza?: string, anime?: string, orden?: string): QueryKey => [
    'cartas',
    'pagina',
    rareza ?? 'TODAS',
    anime ?? 'TODOS',
    orden ?? 'POSEIDAS',
  ],
  oddsCartas: (): QueryKey => ['cartas', 'odds'],
  sobresGratis: (): QueryKey => ['cartas', 'sobres-gratis'],
  tierListsMine: (): QueryKey => ['tier-lists', 'mine'],
  tierListPublic: (slug: string | undefined): QueryKey => ['tier-lists', 'public', slug],
}
