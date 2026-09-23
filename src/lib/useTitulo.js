import { useEffect } from 'react'

const MARCA = 'AnimeShowdown'

/** Título de la pestaña para la página actual: «Galería · AnimeShowdown». */
export function tituloDePagina(texto) {
  return texto ? `${texto} · ${MARCA}` : MARCA
}

/** Sincroniza document.title con la página que se muestra. */
export function useTitulo(texto) {
  useEffect(() => {
    document.title = tituloDePagina(texto)
  }, [texto])
}
