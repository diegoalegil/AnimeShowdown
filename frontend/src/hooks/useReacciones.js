import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'

/**
 * Hooks para reactions emoji sobre un target (Plan v2 §4.3).
 *
 * - useReacciones(targetType, targetId): query con counts + miReaccion.
 * - useAplicarReaccion: mutation que llama POST y actualiza la query
 *   con el resumen devuelto por el backend. Sin optimistic update — el
 *   backend devuelve el estado final tras la lógica toggle/swap, así
 *   evitamos divergencias entre cliente y server.
 */

function buildKey(targetType, targetId) {
  return ['reacciones', targetType, String(targetId)]
}

export function useReacciones(targetType, targetId, { enabled = true } = {}) {
  return useQuery({
    queryKey: buildKey(targetType, targetId),
    queryFn: () => endpoints.getReacciones(targetType, targetId),
    enabled: enabled && Boolean(targetType) && Boolean(targetId),
    // Stale 30s: el backend ya nos devolverá lo último tras cada
    // mutación, así que solo necesitamos refetch periódico si otro
    // usuario reacciona desde otra sesión.
    staleTime: 30_000,
  })
}

export function useAplicarReaccion(targetType, targetId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tipo) =>
      endpoints.aplicarReaccion({ targetType, targetId, tipo }),
    onSuccess: (resumen) => {
      // Reemplazamos directamente el cache con el resumen devuelto. Más
      // eficiente que invalidate+refetch.
      queryClient.setQueryData(buildKey(targetType, targetId), resumen)
    },
  })
}
