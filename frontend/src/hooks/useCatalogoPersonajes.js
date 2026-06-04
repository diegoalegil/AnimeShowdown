import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import {
  CATALOGO_PERSONAJES_STORAGE_KEY,
  normalizarCatalogoPersonajes,
  syncCatalogoPersonajes,
} from '../lib/personajes-core'

const FIELDS = 'id,slug,nombre,anime,imagenUrl,imagenColorDominante'
const CATALOG_STALE_MS = 10 * 60 * 1000

function readPersistedCatalogo() {
  try {
    const raw = localStorage.getItem(CATALOGO_PERSONAJES_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    // initialData already normalized by persistCatalogo → direct pass
    return Array.isArray(parsed) ? parsed : undefined
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

export function useCatalogoPersonajes({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['personajes', 'catalogo', FIELDS],
    queryFn: () => endpoints.personajesCatalogo({ fields: FIELDS }),
    enabled,
    // initialData SIEMPRE (no gateada por enabled): leer localStorage es barato y
    // sin red, y enabled:false ya evita el FETCH. Si App monta esta query disabled
    // en una ruta bypass (/votar) como PRIMER observer, NO sembrar initialData
    // dejaba la query sin datos para consumidores enabled del mismo key (VotarPage
    // resuelve el duelo fijado ?personaje=&rival= via usePersonajesCatalogo) -> e2e roto.
    initialData: readPersistedCatalogo,
    initialDataUpdatedAt: 0,
    staleTime: CATALOG_STALE_MS,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    networkMode: 'always',
    // Normalize once at the query level — query.data is always normalized,
    // so usePersonajesCatalogo() can return query.data directly (no double
    // normalization on every caller). Both localStorage (initialData) and
    // fresh API responses go through this select.
    select: (data) => normalizarCatalogoPersonajes(data),
  })

  useEffect(() => {
    if (!enabled) return
    // Persist raw data for next load's initialData; sync also runs normalization.
    persistCatalogo(query.data)
    syncCatalogoPersonajes(query.data)
  }, [enabled, query.data])

  return query
}
