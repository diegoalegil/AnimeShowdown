import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from '../contexts/AuthContext'

const PAGINA_LIMIT = 60

/**
 * Invalida las queries de colección (cabecera + páginas + el endpoint legacy)
 * tras una mutación que cambia saldo/cartas. No toca odds (estáticas).
 */
function invalidarColeccion(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.coleccionCartas() })
  queryClient.invalidateQueries({ queryKey: queryKeys.coleccionResumen() })
  queryClient.invalidateQueries({ queryKey: ['cartas', 'pagina'] })
}

/**
 * Hooks de cartas coleccionables.
 *
 * - useColeccionResumen / useColeccionPagina: cabecera ligera + lista paginada.
 * - useOddsCartas: probabilidades transparentes del sobre.
 * - useAbrirSobre: mutation que gasta moneda y revela un sobre; al terminar
 *   invalida la colección para refrescar saldo y progreso.
 * - useCofreDiario: reclama la recompensa diaria idempotente del servidor.
 */
/**
 * Cabecera de la colección: totales, saldo, pity, flags y progreso por anime y
 * rareza. Sin el array de cartas (ese se pagina con useColeccionPagina). Es la
 * fuente ligera de la cabecera en la página y el banner.
 */
export function useColeccionResumen() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.coleccionResumen(),
    queryFn: endpoints.coleccionResumen,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
}

/**
 * Saldo de monedas del usuario para el indicador global de la cabecera. Ligero
 * (solo el saldo) y disabled sin user. Se invalida con la colección al votar /
 * abrir sobres (invalidarColeccion no lo toca; el wallet se refresca por su
 * staleTime y al navegar a /cartas).
 */
export function useSaldo() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['monedero'],
    queryFn: endpoints.miMonedero,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
}

/**
 * Set de slugs de personaje de los que el usuario POSEE la carta especial, para
 * el badge "tienes la especial" en duelos/votos. Disabled sin user (→ undefined,
 * el consumidor trata como vacío).
 */
// Identidad estable a nivel de módulo: TanStack v5 cachea el resultado del
// select por (función, data) — una arrow inline re-corría filter+map+Set en
// cada render del consumidor (VotarPage, el hot path).
const selectEspecialesPoseidas = (data) =>
  new Set((data?.cartas ?? []).filter((c) => c.poseida).map((c) => c.personajeSlug))

export function useMisEspeciales() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['cartas', 'especiales', 'mias'],
    queryFn: () => endpoints.coleccionPagina({ rareza: 'ESPECIAL', limit: 120 }),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    select: selectEspecialesPoseidas,
  })
}

/**
 * Grid de colección paginado y filtrado en servidor por rareza/anime. Cada
 * "Cargar más" pide la siguiente página (offset += limit) en vez de cargar el
 * catálogo entero de golpe.
 */
export function useColeccionPagina({ rareza, anime, orden } = {}) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: queryKeys.coleccionPagina(rareza, anime, orden),
    queryFn: ({ pageParam = 0 }) =>
      endpoints.coleccionPagina({ rareza, anime, orden, offset: pageParam, limit: PAGINA_LIMIT }),
    enabled: Boolean(user),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage?.hayMas ? lastPage.offset + lastPage.limit : undefined,
    staleTime: 30 * 1000,
  })
}

export function useOddsCartas() {
  // Odds públicas: GET /api/cartas/odds es permitAll (datos de diseño globales,
  // no-PII), así el invitado ve la transparencia de probabilidades antes de
  // registrarse. Por eso NO se gatea con `enabled: Boolean(user)`.
  return useQuery({
    queryKey: queryKeys.oddsCartas(),
    queryFn: endpoints.oddsCartas,
    staleTime: 10 * 60 * 1000,
  })
}

export function useAbrirSobre() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.abrirSobre,
    onSuccess: () => {
      invalidarColeccion(queryClient)
    },
  })
}

export function useCofreDiario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.cofreDiario,
    onSuccess: () => {
      invalidarColeccion(queryClient)
    },
  })
}

/**
 * Reclama el sobre de bienvenida (gratis, una sola vez, especial garantizada).
 * Al terminar invalida la colección para refrescar saldo y ocultar el banner.
 */
export function useSobreBienvenida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.sobreBienvenida,
    onSuccess: () => {
      invalidarColeccion(queryClient)
    },
  })
}

/** Sobres gratis pendientes (recompensas de evento por abrir). */
export function useSobresGratis() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.sobresGratis(),
    queryFn: endpoints.sobresGratis,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
}

/**
 * Abre un crédito de sobre gratis. Invalida la colección (saldo/cartas) y la
 * lista de sobres gratis para que el CTA desaparezca al agotar el crédito.
 */
export function useAbrirSobreGratis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.abrirSobreGratis,
    onSuccess: () => {
      invalidarColeccion(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.sobresGratis() })
    },
  })
}

export function useDescargarCarta() {
  return useMutation({
    mutationFn: async (carta) => {
      const { blob, filename } = await endpoints.descargarCarta(carta.id)
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = filename || fallbackFilename(carta)
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 1000)
      return { filename: a.download }
    },
  })
}

function fallbackFilename(carta) {
  const raw = carta?.personajeSlug || carta?.personajeNombre || carta?.id || 'carta'
  const slug = String(raw).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `carta-${slug || 'anime'}.png`
}
