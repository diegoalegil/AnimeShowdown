import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * Hooks del flujo de torneos creados por usuario.
 *
 * - useMisTorneos: lista del propio creador (todos los estados).
 * - useCrearTorneoMio: mutation con invalidación de /mios.
 * - useTorneosPendientes: cola admin, refetch cada 30s.
 * - useAprobarTorneo / useRechazarTorneo: admin actions con invalidación
 *   de la cola y del listado público (los aprobados aparecen ahí).
 */

export function useMisTorneos() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['torneos', 'mios'],
    queryFn: endpoints.misTorneos,
    enabled: Boolean(user),
    staleTime: 15_000,
  })
}

export function useCrearTorneoMio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.crearTorneoMio,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torneos', 'mios'] })
    },
  })
}

export function useTorneosPendientes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['torneos', 'pendientes-admin'],
    queryFn: endpoints.torneosPendientes,
    enabled: user?.rol === 'ADMIN',
    refetchInterval: 30_000,
  })
}

export function useAprobarTorneo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.aprobarTorneo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torneos', 'pendientes-admin'] })
      // El listado público gana un torneo nuevo cuando se aprueba.
      qc.invalidateQueries({ queryKey: ['torneos'] })
    },
  })
}

export function useRechazarTorneo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }) => endpoints.rechazarTorneo(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torneos', 'pendientes-admin'] })
    },
  })
}
