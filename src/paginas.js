// Páginas que se descargan aparte del código inicial: solo se necesitan al
// visitarlas y así la portada arranca con menos JavaScript. Se precargan
// cuando el navegador queda libre (ver main.jsx): la ficha en cuanto
// termina de arrancar (es el paso natural desde la galería y pesa poco);
// sobres y colección, tras la carga de la portada.
import { diferido } from './lib/diferido.js'

export const ficha = diferido(() => import('./pages/Ficha.jsx'))
export const sobres = diferido(() => import('./pages/Sobres.jsx'))
export const coleccion = diferido(() => import('./pages/Coleccion.jsx'))

/** Precarga especulativa: si falla, no pasa nada; se volverá a pedir al visitarlas. */
export function precargarPaginas(paginas) {
  for (const pagina of paginas) pagina.precargar().catch(() => {})
}
