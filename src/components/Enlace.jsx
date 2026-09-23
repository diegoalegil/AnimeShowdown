import { urlPublica } from '../lib/images.js'

/**
 * Enlace interno: un <a href> normal con la ruta base. La navegación dentro
 * de la aplicación la resuelve el listener delegado de lib/navegacion.
 */
export function Enlace({ to, ...props }) {
  return <a href={urlPublica(to.replace(/^\//, ''))} {...props} />
}
