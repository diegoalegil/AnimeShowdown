import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/
const USERNAME_MIN = 3
const USERNAME_MAX = 30
const DEBOUNCE_MS = 350

/**
 * V-8: chequeo en vivo de disponibilidad de username contra
 * GET /me/username-available, con debounce + cancelación (vía TanStack Query).
 *
 * Estados:
 *   - 'idle'      vacío / aún no se evaluó.
 *   - 'same'      coincide con el username actual (es tuyo → válido).
 *   - 'invalid'   no cumple formato (3-30, alfanumérico + _ -).
 *   - 'checking'  debounce o petición en vuelo.
 *   - 'available' libre.
 *   - 'taken'     ya en uso por otra cuenta.
 *   - 'error'     fallo de red (el submit aún se permite; el backend revalida).
 *
 * 'same', 'available' y 'error' se consideran enviables (`puedeEnviar`).
 */
export function useUsernameAvailability(value, currentUsername) {
  const trimmed = (value || '').trim()
  const formatoOk =
    trimmed.length >= USERNAME_MIN &&
    trimmed.length <= USERNAME_MAX &&
    USERNAME_PATTERN.test(trimmed)
  const esElMismo =
    trimmed.length > 0 &&
    trimmed.toLowerCase() === (currentUsername || '').toLowerCase()

  // Estados que se resuelven sin ir al backend: se derivan en render.
  const syncStatus =
    trimmed.length === 0
      ? 'idle'
      : esElMismo
        ? 'same'
        : !formatoOk
          ? 'invalid'
          : null

  // Debounce del valor para no pegar al backend en cada tecla. El setState va
  // dentro del callback del timeout (no síncrono en el efecto).
  const [debounced, setDebounced] = useState(trimmed)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [trimmed])

  const remotoNecesario = syncStatus === null
  const query = useQuery({
    queryKey: ['username-available', debounced],
    queryFn: ({ signal }) => endpoints.usernameAvailable(debounced, { signal }),
    enabled: remotoNecesario && debounced === trimmed,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 0,
    networkMode: 'always',
  })

  let status
  if (syncStatus) {
    status = syncStatus
  } else if (debounced !== trimmed || query.isPending || query.isFetching) {
    // Aún debouncing o esperando respuesta.
    status = 'checking'
  } else if (query.isError) {
    status = 'error'
  } else {
    status = query.data?.available ? 'available' : 'taken'
  }

  const puedeEnviar =
    trimmed.length > 0 &&
    (status === 'same' || status === 'available' || status === 'error')

  return { status, puedeEnviar, trimmed }
}
