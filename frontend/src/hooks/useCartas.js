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

/**
 * Reclama el sobre de bienvenida (gratis, una sola vez, especial garantizada).
 * Al terminar invalida la colección para refrescar saldo y ocultar el banner.
 */
export function useSobreBienvenida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.sobreBienvenida,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coleccionCartas() })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.coleccionCartas() })
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
