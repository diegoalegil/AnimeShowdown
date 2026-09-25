import { useSyncExternalStore } from 'react'

const sinCambios = () => () => {}

/**
 * false al prerenderizar y mientras React hidrata ese HTML; true en cuanto
 * termina (y desde el principio en las páginas que se pintan en el
 * navegador). Lo que depende del visitante (su colección, su día, su
 * pantalla o la dirección con filtros) se pinta solo cuando es true: el HTML
 * prerenderizado de la portada no puede saberlo (ver scripts/prerender.mjs).
 */
export function useHidratado() {
  return useSyncExternalStore(
    sinCambios,
    () => true,
    () => false,
  )
}
