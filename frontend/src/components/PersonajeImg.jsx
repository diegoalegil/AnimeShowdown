import { useState } from 'react'
import { getPersonajeBySlug, imagenPersonaje } from '../data/personajes'
import PersonajePlaceholder from './PersonajePlaceholder'

/**
 * <img> de personaje con fallback premium (Plan v2 §3.3-3.4).
 *
 * Si la imagen real falla (404 en producción, slug sin imagen, error de
 * red…) renderiza un <PersonajePlaceholder> en su lugar — iniciales,
 * anime y kanji decorativo. Nunca se muestra el icono de imagen rota
 * del navegador.
 *
 * Antes había un <picture> con srcset AVIF + WebP por anchos (300/600
 * /1024) generados por generate-image-variants.mjs, pero el build de
 * Cloudflare usa build:no-images (esquiva el timeout de 20 min) y las
 * variantes no llegan a producción — el <picture> daba 404 en cascada.
 */
// eslint-disable-next-line no-unused-vars
function PersonajeImg({ slug, alt, sizes, className = '', ...imgProps }) {
  const [errored, setErrored] = useState(false)
  const src = imagenPersonaje(slug)

  if (errored) {
    const p = getPersonajeBySlug(slug)
    return (
      <PersonajePlaceholder
        nombre={p?.nombre ?? slug}
        anime={p?.anime ?? 'Anime desconocido'}
        className={className}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      {...imgProps}
    />
  )
}

export default PersonajeImg
