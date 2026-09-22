import { useSyncExternalStore } from 'react'
import { catalogo } from './catalog.js'
import { crearAlmacen } from './collection.js'

/** Almacén único de la colección de este navegador. */
export const coleccion = crearAlmacen({
  storage: () => window.localStorage,
  ids: {
    personajes: catalogo.personajes.map((c) => c.id),
    especiales: catalogo.especiales.map((c) => c.id),
  },
  existe: catalogo.existe,
  ventana: typeof window === 'undefined' ? undefined : window,
})

/** Estado de la colección; el componente se vuelve a pintar cuando cambia. */
export function useColeccion() {
  return useSyncExternalStore(coleccion.subscribe, coleccion.getSnapshot, coleccion.getSnapshot)
}
