import { imagenPersonaje } from '../data/personajes'

/**
 * <img> de personaje (Plan v2 §3.3-3.4).
 *
 * Versión simplificada: usa solo la imagen original. Antes había <picture>
 * con srcset AVIF + WebP por anchos (300/600/1024) generados por
 * generate-image-variants.mjs, pero el build de Cloudflare usa
 * build:no-images (para esquivar el timeout de 20 min) y por tanto las
 * variantes no llegan a producción — el <picture> intentaba cargar URLs
 * 404 y mostraba el icono de imagen rota.
 *
 * Cuando movamos a build full en CF reactivamos el <picture> srcset.
 * Mientras tanto este componente es un wrapper trivial que sigue
 * dándonos un punto único para evolucionar.
 *
 * Props acepta cualquier prop válida de <img>.
 */
// eslint-disable-next-line no-unused-vars
function PersonajeImg({ slug, alt, sizes, ...imgProps }) {
  return <img src={imagenPersonaje(slug)} alt={alt} {...imgProps} />
}

export default PersonajeImg
