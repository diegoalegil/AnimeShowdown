import { useMemo } from 'react'
import { useCatalogoPersonajes } from './useCatalogoPersonajes'
import { normalizarCatalogoPersonajes } from '../lib/personajes-core'

export function usePersonajesCatalogo() {
  const query = useCatalogoPersonajes()
  const lista = useMemo(
    () => normalizarCatalogoPersonajes(query.data),
    [query.data],
  )

  return {
    ...query,
    personajes: lista,
  }
}
