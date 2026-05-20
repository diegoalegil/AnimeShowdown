import { useState } from 'react'
import { getPersonajeBySlug, imagenPersonaje } from '../data/personajes'
import PersonajePlaceholder from './PersonajePlaceholder'

/**
 * <img> de personaje con fallback premium + responsive (Plan v2 §3.3-3.4, §3.6).
 *
 * <p>Si la imagen real falla (404, slug sin imagen, error de red…) renderiza
 * un {@link PersonajePlaceholder} en su lugar — iniciales, anime y kanji
 * decorativo. Nunca se muestra el icono de imagen rota del navegador.
 *
 * <p>Performance: usa {@code <picture>} con srcset AVIF + WebP por anchos
 * (300/600/1024) generados por {@code generate-image-variants.mjs}. El
 * navegador elige el formato más eficiente que soporte y el ancho que
 * encaje con su viewport. Las variantes se commitean al repo (decisión
 * 2026-05-17 tras bug de performance en producción) — antes Cloudflare
 * Pages skipeaba el script con {@code build:no-images} y servía la
 * original 1024px a cards de 200px, costando ~30MB por página.
 *
 * <p>Lazy loading y async decoding por default. El caller puede override
 * (p.ej. {@code loading="eager" fetchpriority="high"} para LCP).
 */
function PersonajeImg({ slug, alt, sizes, className = '', loading, decoding, ...imgProps }) {
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

  // Variantes responsive desde el src original. Solo -300 y -600 webp
  // (decisión 2026-05-17): cubren cards pequeñas/medianas con ahorro 5-15%
  // del peso original. -1024 y AVIF se generan pero NO se commitean
  // (sumarían +500MB al repo sin ganancia perceptible — el original cubre
  // pantallas grandes y ficha de personaje). El src original (1024px) es
  // el fallback que pinta el <img>.
  const queryIndex = src.indexOf('?')
  const srcPath = queryIndex === -1 ? src : src.slice(0, queryIndex)
  const srcQuery = queryIndex === -1 ? '' : src.slice(queryIndex)
  const base = srcPath.replace(/\.webp$/i, '')
  const isWebp = /\.webp$/i.test(srcPath)
  const srcsetWebp = isWebp
    ? `${base}-300.webp${srcQuery} 300w, ${base}-600.webp${srcQuery} 600w`
    : undefined
  // sizes default: estimación conservadora para que el browser no
  // sobre-descargue en mobile. El caller puede pasar sizes específico
  // (e.g. la imagen grande de la ficha de personaje usaría algo mayor).
  const sizesAttr = sizes ?? '(min-width: 1024px) 200px, (min-width: 640px) 160px, 140px'

  return (
    <picture>
      {srcsetWebp && (
        <source type="image/webp" srcSet={srcsetWebp} sizes={sizesAttr} />
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading ?? 'lazy'}
        decoding={decoding ?? 'async'}
        onError={() => setErrored(true)}
        {...imgProps}
      />
    </picture>
  )
}

export default PersonajeImg
