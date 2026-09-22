import { useEffect, useRef } from 'react'
import { activarInclinacion } from './motion.js'

/**
 * Activa la inclinación para las cartas dentro del elemento que reciba la
 * ref. Un único par de listeners para todo el contenedor.
 */
export function useInclinacion() {
  const ref = useRef(null)
  useEffect(() => activarInclinacion(ref.current), [])
  return ref
}
