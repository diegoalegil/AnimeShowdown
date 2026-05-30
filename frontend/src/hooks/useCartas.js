import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hooks de cartas coleccionables (Fase 1).
 *
 * - useColeccion: catálogo + obtenidas + % + saldo. Disabled sin user (la API
 *   es autenticada; evita el 403 ruidoso en consola).
 * - useOddsCartas: probabilidades transparentes del sobre.
 * - useAbrirSobre: mutation que gasta moneda y revela una carta; al terminar
 *   invalida la colección para refrescar saldo y progreso.
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
