import { useSyncExternalStore } from 'react'
import { catalogo } from './catalog.js'
import { cartasDistintas, crearAlmacen } from './collection.js'
import { cuentaRetenida } from './cuentaRetenida.js'

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

/**
 * Cartas distintas que muestra la cabecera: la cuenta real, salvo mientras
 * se abre un sobre (ver cuentaRetenida).
 */
export function useCuentaVisible() {
  const real = cartasDistintas(useColeccion())
  const retenida = useSyncExternalStore(cuentaRetenida.subscribe, cuentaRetenida.getSnapshot, cuentaRetenida.getSnapshot)
  return retenida ?? real
}
