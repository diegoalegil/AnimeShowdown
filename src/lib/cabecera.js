import { anticipar } from './images.js'
import { revelar } from './motion.js'

/**
 * Ref de la cabecera de una serie (el estandarte de la galería, la franja de
 * cada hoja del álbum): entra con la coreografía (revelar) y, como se salta
 * fuera de pantalla, su escenario y su emblema se piden al acercarse
 * (anticipar). Es la misma función para todas.
 */
export function refCabecera(cabecera) {
  const dejarDeRevelar = revelar(cabecera)
  const dejarDeAnticipar = anticipar(cabecera)
  return () => {
    dejarDeRevelar?.()
    dejarDeAnticipar?.()
  }
}
