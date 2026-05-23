import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import {
  CATALOGO_PERSONAJES_STORAGE_KEY,
  normalizarCatalogoPersonajes,
  syncCatalogoPersonajes,
} from '../lib/personajes-core'

const FIELDS = 'slug,nombre,anime,imagenUrl,imagenColorDominante'

function readPersistedCatalogo() {
  try {
    const raw = localStorage.getItem(CATALOGO_PERSONAJES_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? normalizarCatalogoPersonajes(parsed) : undefined
  } catch {
    return undefined
  }
}

function persistCatalogo(data) {
  try {
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem(CATALOGO_PERSONAJES_STORAGE_KEY, JSON.stringify(data))
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
    networkMode: 'always',
  })

  syncCatalogoPersonajes(query.data)

  useEffect(() => {
    persistCatalogo(query.data)
    syncCatalogoPersonajes(query.data)
  }, [query.data])

  return query
}
