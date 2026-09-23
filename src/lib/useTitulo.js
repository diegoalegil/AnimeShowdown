import { useEffect } from 'react'
import { usePaginaActiva } from './paginaActiva.js'
import { tituloDePagina } from './titulos.js'

/** Sincroniza document.title con la página que se muestra (si es la activa). */
export function useTitulo(texto) {
  const activa = usePaginaActiva()
  useEffect(() => {
    if (activa) document.title = tituloDePagina(texto)
  }, [texto, activa])
}
