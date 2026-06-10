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

// Identidad ESTABLE del select: React Query solo reutiliza el resultado
// memoizado si la función es la MISMA referencia entre renders (queryObserver
// compara options.select por identidad). Con una arrow inline, cada render de
// cada observer re-normalizaba los ~1086 items (un spread por item) y
// query.data cambiaba de identidad → invalidaba todos los useMemo derivados
// (índices con 6 sorts por keystroke) y anulaba los memo() de las 60 cards.
const selectCatalogo = (data) => normalizarCatalogoPersonajes(data)

// El hook se monta en 30+ consumidores: sin guard, cada actualización real
// disparaba N escrituras idénticas de ~174KB a localStorage (una por
// consumidor). Con query.data de identidad estable basta recordar la última
// referencia sincronizada a nivel de módulo.
let ultimoCatalogoSincronizado

export function useCatalogoPersonajes({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['personajes', 'catalogo', FIELDS],
    queryFn: () => endpoints.personajesCatalogo({ fields: FIELDS }),
    // Gateado por ruta desde App.jsx: en rutas sin personajes (auth/legal) no se
    // ceba. OJO React Query: si CUALQUIER observer de esta key está enabled, la
    // query corre — por eso el gate vive donde está el ÚNICO observer en esas
    // rutas (App.jsx); los consumidores de contenido siguen con enabled=true.
    enabled,
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
    select: selectCatalogo,
  })

  useEffect(() => {
    // Persist raw data for next load's initialData; sync also runs normalization.
    // Solo cuando la referencia cambió de verdad (guard de módulo de arriba).
    if (!query.data || query.data === ultimoCatalogoSincronizado) return
    ultimoCatalogoSincronizado = query.data
    persistCatalogo(query.data)
    syncCatalogoPersonajes(query.data)
  }, [query.data])

  return query
}
