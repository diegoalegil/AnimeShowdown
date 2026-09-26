// Grupos de cartas de las rejillas (la galería y las hojas del álbum). El
// navegador se salta el trabajo de lo que queda fuera de pantalla
// (content-visibility) por grupos de dos o tres filas y no carta a carta: con
// mil cartas vigiladas una a una, comprobar cuáles están cerca de la pantalla
// llenaba el hilo principal en cada frame. Tampoco por series enteras: una
// hoja del álbum puede ocupar cinco pantallas, y al acercarse se pedirían
// todas sus imágenes de golpe (ver anticipar en lib/images).
import { useSyncExternalStore } from 'react'

/**
 * Columnas de la rejilla de la galería según el ancho (las mismas que .muro
 * en galeria.css) y filas por grupo: unas diez cartas en cualquier ancho.
 */
export const DISPOSICIONES = [
  { consulta: '(min-width: 75rem)', columnas: 5, filas: 2 },
  { consulta: '(min-width: 64rem)', columnas: 4, filas: 3 },
  { consulta: '(min-width: 48rem)', columnas: 3, filas: 3 },
]
const MOVIL = { columnas: 2, filas: 3 }

/** Lo mismo para los huecos de una hoja del álbum (.bolsillos en coleccion.css). */
export const DISPOSICIONES_ALBUM = [
  { consulta: '(min-width: 68.75rem)', columnas: 6, filas: 2 },
  { consulta: '(min-width: 48rem)', columnas: 5, filas: 2 },
]
const MOVIL_ALBUM = { columnas: 3, filas: 3 }

/** Parte `lista` en trozos de `tamano` elementos (el último puede ser menor). */
export function trocear(lista, tamano) {
  const n = Math.max(1, Math.floor(tamano) || 1)
  const trozos = []
  for (let i = 0; i < lista.length; i += n) trozos.push(lista.slice(i, i + n))
  return trozos
}

/**
 * Disposición para un ancho, a partir de una función que evalúa media
 * queries: la primera de `disposiciones` que coincida o, si ninguna, `movil`.
 */
export function disposicion(coincide = () => false, disposiciones = DISPOSICIONES, movil = MOVIL) {
  return disposiciones.find((d) => coincide(d.consulta)) ?? movil
}

/**
 * Hook con la disposición actual de una rejilla: { columnas, filas, tamano }
 * (tamano = cartas por grupo). Cambia al cruzar un punto de corte; en el
 * prerenderizado y antes de hidratar vale la del móvil.
 */
function crearUsoDisposicion(disposiciones, movil) {
  let listas = null
  const hayMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const obtenerListas = () => (listas ??= disposiciones.map((d) => window.matchMedia(d.consulta)))

  function suscribir(aviso) {
    if (!hayMatchMedia()) return () => {}
    const todas = obtenerListas()
    for (const l of todas) l.addEventListener('change', aviso)
    return () => {
      for (const l of todas) l.removeEventListener('change', aviso)
    }
  }

  function columnasActuales() {
    if (!hayMatchMedia()) return movil.columnas
    const todas = obtenerListas()
    const coincide = (consulta) => todas[disposiciones.findIndex((d) => d.consulta === consulta)].matches
    return disposicion(coincide, disposiciones, movil).columnas
  }

  return function useDisposicion() {
    const columnas = useSyncExternalStore(suscribir, columnasActuales, () => movil.columnas)
    const { filas } = disposiciones.find((d) => d.columnas === columnas) ?? movil
    return { columnas, filas, tamano: columnas * filas }
  }
}

/** Disposición de la rejilla de la galería. */
export const useDisposicionMuro = crearUsoDisposicion(DISPOSICIONES, MOVIL)

/** Disposición de los huecos de las hojas del álbum. */
export const useDisposicionAlbum = crearUsoDisposicion(DISPOSICIONES_ALBUM, MOVIL_ALBUM)
