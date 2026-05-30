import { useCatalogoPersonajes } from './useCatalogoPersonajes'

// catalogoPersonajes singleton lives in personajes-core.ts.
// useCatalogoPersonajes already normalizes on read (localStorage or API).
// usePersonajesCatalogo was re-normalizing via normalizarCatalogoPersonajes()
// on every call — double normalization when reading from localStorage.
// Fix: return query.data directly. React Query's structural sharing
// means the object reference only changes on data updates, not on navigation.
export function usePersonajesCatalogo() {
  const query = useCatalogoPersonajes()
  return {
    ...query,
    personajes: query.data ?? [],
  }
}