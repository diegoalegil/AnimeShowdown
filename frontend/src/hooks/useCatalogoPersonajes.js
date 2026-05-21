import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'

const STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'
const FIELDS = 'slug,nombre,anime,imagenUrl'

function readPersistedCatalogo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function persistCatalogo(data) {
  try {
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch {
    // localStorage puede fallar en private mode; el cache de React Query basta.
  }
}

export function useCatalogoPersonajes() {
  const query = useQuery({
    queryKey: ['personajes', 'catalogo', FIELDS],
    queryFn: () => endpoints.personajesCatalogo({ fields: FIELDS }),
    initialData: readPersistedCatalogo,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  useEffect(() => {
    persistCatalogo(query.data)
  }, [query.data])

  return query
}
