import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hooks de cartas coleccionables.
 *
 * - useColeccion: catálogo + obtenidas + % + saldo. Disabled sin user (la API
 *   es autenticada; evita el 403 ruidoso en consola).
 * - useOddsCartas: probabilidades transparentes del sobre.
 * - useAbrirSobre: mutation que gasta moneda y revela un sobre; al terminar
 *   invalida la colección para refrescar saldo y progreso.
 * - useCofreDiario: reclama la recompensa diaria idempotente del servidor.
 */
export function useColeccion() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.coleccionCartas(),
    queryFn: endpoints.miColeccion,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
}

export function useOddsCartas() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.oddsCartas(),
    queryFn: endpoints.oddsCartas,
    enabled: Boolean(user),
    staleTime: 10 * 60 * 1000,
  })
}

export function useAbrirSobre() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.abrirSobre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coleccionCartas() })
    },
  })
}

export function useCofreDiario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.cofreDiario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coleccionCartas() })
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

export function useCartaTrades() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.cartasTrades(),
    queryFn: endpoints.cartasTrades,
    enabled: Boolean(user),
    staleTime: 20 * 1000,
  })
}

export function useCrearCartaTrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.crearCartaTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartasTrades() })
    },
  })
}

export function useResolverCartaTrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tradeId, action }) => {
      if (action === 'accept') return endpoints.aceptarCartaTrade(tradeId)
      if (action === 'reject') return endpoints.rechazarCartaTrade(tradeId)
      return endpoints.cancelarCartaTrade(tradeId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartasTrades() })
      queryClient.invalidateQueries({ queryKey: queryKeys.coleccionCartas() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cartasShowcase() })
    },
  })
}

export function useCartaShowcase({ enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.cartasShowcase(),
    queryFn: endpoints.cartasShowcase,
    enabled: enabled && Boolean(user),
    staleTime: 30 * 1000,
  })
}

export function useSetCartaShowcase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.fijarCartaShowcase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartasShowcase() })
      queryClient.invalidateQueries({ queryKey: queryKeys.salonLegendarioCartas() })
    },
  })
}

export function useLimpiarCartaShowcase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.limpiarCartaShowcase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartasShowcase() })
      queryClient.invalidateQueries({ queryKey: queryKeys.salonLegendarioCartas() })
    },
  })
}

export function useCartasShowcasePublico(username) {
  return useQuery({
    queryKey: queryKeys.cartasShowcasePublico(username),
    queryFn: () => endpoints.cartasShowcasePublico(username),
    enabled: Boolean(username),
    staleTime: 60 * 1000,
  })
}

export function useSalonLegendario() {
  return useQuery({
    queryKey: queryKeys.salonLegendarioCartas(),
    queryFn: endpoints.salonLegendarioCartas,
    staleTime: 60 * 1000,
  })
}

export function useCartaEspecialPersonaje(slug, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.cartaEspecialPersonaje(slug),
    queryFn: () => endpoints.cartaEspecialPersonaje(slug),
    enabled: enabled && Boolean(slug),
    staleTime: 10 * 60 * 1000,
    retry: (count, err) => err?.status !== 404 && count < 1,
  })
}

export function useCartaPublica(cartaId) {
  return useQuery({
    queryKey: queryKeys.cartaPublica(cartaId),
    queryFn: () => endpoints.cartaPublica(cartaId),
    enabled: Boolean(cartaId),
    staleTime: 10 * 60 * 1000,
    retry: (count, err) => err?.status !== 404 && count < 1,
  })
}

function fallbackFilename(carta) {
  const raw = carta?.personajeSlug || carta?.personajeNombre || carta?.id || 'carta'
  const slug = String(raw).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `carta-${slug || 'anime'}.png`
}
