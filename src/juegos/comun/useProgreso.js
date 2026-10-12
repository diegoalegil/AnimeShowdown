import { useSyncExternalStore } from 'react'
import { crearAlmacenProgreso, progresoDe, progresoVacio } from './progreso.js'

/** Almacén único del progreso de los juegos en este navegador. */
export const progreso = crearAlmacenProgreso({
  storage: () => window.localStorage,
  ventana: typeof window === 'undefined' ? undefined : window,
})

// Al prerenderizar no hay progreso de nadie: se parte de uno vacío.
const SIN_PROGRESO = progresoVacio()
const sinProgreso = () => SIN_PROGRESO

/** Progreso de todos los juegos; el componente se vuelve a pintar cuando cambia. */
export function useProgreso() {
  return useSyncExternalStore(progreso.subscribe, progreso.getSnapshot, sinProgreso)
}

/** Progreso de un juego: { racha, record, jugadas, ganadas, mejor } (ceros si no se ha jugado). */
export function useProgresoJuego(slug) {
  return progresoDe(useProgreso(), slug)
}
