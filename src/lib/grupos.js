// Grupos de cartas de la rejilla de la galería. El navegador se salta el
// trabajo de lo que queda fuera de pantalla (content-visibility) por grupos
// de dos o tres filas y no carta a carta: con mil cartas vigiladas una a una,
// comprobar cuáles están cerca de la pantalla llenaba el hilo principal en
// cada frame.
import { useSyncExternalStore } from 'react'

/**
 * Columnas de la rejilla según el ancho (las mismas que .muro en
 * galeria.css) y filas por grupo: unas diez cartas en cualquier ancho.
 */
export const DISPOSICIONES = [
  { consulta: '(min-width: 75rem)', columnas: 5, filas: 2 },
  { consulta: '(min-width: 64rem)', columnas: 4, filas: 3 },
  { consulta: '(min-width: 48rem)', columnas: 3, filas: 3 },
]
const MOVIL = { columnas: 2, filas: 3 }

/** Parte `lista` en trozos de `tamano` elementos (el último puede ser menor). */
export function trocear(lista, tamano) {
  const n = Math.max(1, Math.floor(tamano) || 1)
  const trozos = []
  for (let i = 0; i < lista.length; i += n) trozos.push(lista.slice(i, i + n))
  return trozos
}

/** Disposición para un ancho, a partir de una función que evalúa media queries. */
export function disposicion(coincide = () => false) {
  return DISPOSICIONES.find((d) => coincide(d.consulta)) ?? MOVIL
}

let listas = null
const obtenerListas = () => (listas ??= DISPOSICIONES.map((d) => window.matchMedia(d.consulta)))

function suscribir(aviso) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const todas = obtenerListas()
  for (const l of todas) l.addEventListener('change', aviso)
  return () => {
    for (const l of todas) l.removeEventListener('change', aviso)
  }
}

function columnasActuales() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return MOVIL.columnas
  const todas = obtenerListas()
  return disposicion((consulta) => todas[DISPOSICIONES.findIndex((d) => d.consulta === consulta)].matches).columnas
}

/** { columnas, filas, tamano } de la rejilla en el ancho actual; cambia al cruzar un punto de corte. */
export function useDisposicionMuro() {
  const columnas = useSyncExternalStore(suscribir, columnasActuales, () => MOVIL.columnas)
  const { filas } = DISPOSICIONES.find((d) => d.columnas === columnas) ?? MOVIL
  return { columnas, filas, tamano: columnas * filas }
}
