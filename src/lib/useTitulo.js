import { useEffect } from 'react'
import { tituloDePagina } from './titulos.js'

/** Sincroniza document.title con la página que se muestra. */
export function useTitulo(texto) {
  useEffect(() => {
    document.title = tituloDePagina(texto)
  }, [texto])
}
