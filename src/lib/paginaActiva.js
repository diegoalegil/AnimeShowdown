import { createContext, useContext } from 'react'

/**
 * Si la página que contiene al componente es la que se ve. La galería y la
 * colección siguen montadas, ocultas, mientras se mira una ficha abierta
 * desde ellas (ver App.jsx); entonces no deben cambiar el título ni atender
 * al teclado.
 */
export const PaginaActiva = createContext(true)

export const usePaginaActiva = () => useContext(PaginaActiva)
