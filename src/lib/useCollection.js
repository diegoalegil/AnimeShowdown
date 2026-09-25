import { useSyncExternalStore } from 'react'
import { recuento } from './album.js'
import { catalogo } from './catalog.js'
import { crearAlmacen, estadoVacio } from './collection.js'
import { cuentaRetenida } from './cuentaRetenida.js'

/**
 * Almacén único de la colección de este navegador. Los sobres solo sacan
 * cartas visibles; las ocultas que ya se tenían se guardan igual (y viajan en
 * el código de la colección), aunque no se muestren ni se cuenten.
 */
export const coleccion = crearAlmacen({
  storage: () => window.localStorage,
  ids: {
    personajes: catalogo.personajes.map((c) => c.id),
    especiales: catalogo.especiales.map((c) => c.id),
  },
  existe: catalogo.conocida,
  ventana: typeof window === 'undefined' ? undefined : window,
})

// El HTML prerenderizado de la portada no conoce la colección de nadie: se
// hidrata con una vacía y en seguida se pinta la de este navegador.
const SIN_COLECCION = estadoVacio('')
const sinColeccion = () => SIN_COLECCION

/** Estado de la colección; el componente se vuelve a pintar cuando cambia. */
export function useColeccion() {
  return useSyncExternalStore(coleccion.subscribe, coleccion.getSnapshot, sinColeccion)
}

/**
 * Cartas de personajes distintas que muestra la cabecera (la cifra grande
 * del álbum): la cuenta real, salvo mientras se abre un sobre (ver
 * cuentaRetenida).
 */
export function useCuentaVisible() {
  const real = recuento(useColeccion().tengo).personajes.tengo
  const retenida = useSyncExternalStore(cuentaRetenida.subscribe, cuentaRetenida.getSnapshot, cuentaRetenida.getSnapshot)
  return retenida ?? real
}
