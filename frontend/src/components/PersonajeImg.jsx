import { imagenSources } from '../lib/imagen'

/**
 * <img> de personaje con AVIF + WebP + srcset (Plan v2 §3.3-3.4).
 *
 * Reemplaza el viejo patrón `<img src={imagenPersonaje(slug)}>` por un
 * <picture> con dos <source> que el browser negocia automáticamente:
 *   1. AVIF si lo soporta (~98% navegadores modernos en 2026).
 *   2. WebP si no.
 *   3. La original .webp como fallback final del <img>.
 *
 * El `sizes` está pensado para layouts en grid; si lo usas en un contexto
 * donde la imagen ocupa más espacio (hero, detail page) pasa `sizes`
 * custom para que el browser elija el ancho correcto.
 *
 * Props acepta cualquier prop válida de <img> (className, loading, alt,
 * onClick, etc) y las pasa a través.
 */
function PersonajeImg({ slug, alt, sizes, ...imgProps }) {
  const src = imagenSources(slug)
  if (!src) {
    // Fallback duro: slug sin entrada en el catálogo. Usamos el path
    // determinista de imagenPersonaje (que devuelve /img/_missing/...).
    return <img alt={alt} {...imgProps} />
  }
  return (
    <picture>
      <source type="image/avif" srcSet={src.avif} sizes={sizes ?? src.sizes} />
      <source type="image/webp" srcSet={src.webp} sizes={sizes ?? src.sizes} />
      <img src={src.fallback} alt={alt} {...imgProps} />
    </picture>
  )
}

export default PersonajeImg
