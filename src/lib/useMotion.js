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

/**
 * Marca con data-fuera el elemento que reciba la ref mientras esté fuera de
 * la pantalla, para que el CSS detenga lo que se mueve en bucle en él
 * (brasas, focos, cartas flotantes).
 */
export function usePausaFuera() {
  const ref = useRef(null)
  useEffect(() => {
    const elemento = ref.current
    if (!elemento || typeof window.IntersectionObserver !== 'function') return undefined
    const io = new window.IntersectionObserver(([entrada]) => elemento.toggleAttribute('data-fuera', !entrada.isIntersecting))
    io.observe(elemento)
    return () => io.disconnect()
  }, [])
  return ref
}
