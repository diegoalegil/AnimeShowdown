// Páginas que se descargan aparte del código inicial: solo se necesitan al
// visitarlas y así la portada arranca con menos JavaScript. Se precargan en
// cuanto el navegador queda libre (ver main.jsx).
import { diferido } from './lib/diferido.js'

export const sobres = diferido(() => import('./pages/Sobres.jsx'))
export const coleccion = diferido(() => import('./pages/Coleccion.jsx'))

export function precargarPaginas() {
  sobres.precargar()
  coleccion.precargar()
}
