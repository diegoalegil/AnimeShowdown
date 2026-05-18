import { QueryClient } from '@tanstack/react-query'

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
//    (cada 30s, Plan v2 §1.1) ya cubre el caso de torneos en vivo.
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
 * Convención de query keys: array `[recurso, ...identificadores]`.
 * Funciones helper aquí para evitar typos y centralizar invalidaciones.
 */
export const queryKeys = {
  torneos: () => ['torneos'],
  torneoBySlug: (slug) => ['torneos', 'slug', slug],
  torneoById: (id) => ['torneos', 'id', id],
  // Mi roster / favoritos (Plan producto 2026-05-18)
  misFavoritos: () => ['favoritos', 'me'],
  favoritoSlug: (slug) => ['favoritos', 'slug', slug],
  // Actividad reciente de votos (sprint 2026-05-18)
  votosPeriodoSlug: (slug, dias = 7) => ['votos-periodo', 'slug', slug, dias],
  votosPeriodoBatch: (slugs, dias = 7) => ['votos-periodo', 'batch', [...slugs].sort().join(','), dias],
}
