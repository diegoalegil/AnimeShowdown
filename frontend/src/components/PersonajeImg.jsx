import { useState } from 'react'
import { getPersonajeBySlug, imagenPersonaje } from '../lib/personajes-core'
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
function PersonajeImg({
  slug,
  alt,
  sizes,
  className = '',
  loading,
  decoding,
  src: srcOverride,
  nombre,
  colorDominante,
  imagenColorDominante,
  style,
  ...imgProps
}) {
  const [status, setStatus] = useState({ src: null, loaded: false, errored: false })
  const p = getPersonajeBySlug(slug)
  const src = srcOverride ?? imagenPersonaje(slug)
  const loaded = status.src === src && status.loaded
  const errored = status.src === src && status.errored
  const dominantColor =
    colorDominante ?? imagenColorDominante ?? p?.imagenColorDominante ?? '#151923'

  if (errored) {
    return (
      <PersonajePlaceholder
        nombre={p?.nombre ?? nombre ?? slug}
        anime={p?.anime ?? 'Anime desconocido'}
        className={className}
      />
    )
  }

  // Variantes responsive desde el src original. El browser prioriza AVIF
  // cuando lo soporta, cae a WebP si no, y finalmente usa el src original.
  const queryIndex = src.indexOf('?')
  const srcPath = queryIndex === -1 ? src : src.slice(0, queryIndex)
  const srcQuery = queryIndex === -1 ? '' : src.slice(queryIndex)
  const base = srcPath.replace(/\.webp$/i, '')
  const isWebp = /\.webp$/i.test(srcPath)
  const srcsetAvif = isWebp
    ? `${base}-300.avif${srcQuery} 300w, ${base}-600.avif${srcQuery} 600w, ${base}-1024.avif${srcQuery} 1024w`
    : undefined
  const srcsetWebp = isWebp
    ? `${base}-300.webp${srcQuery} 300w, ${base}-600.webp${srcQuery} 600w, ${base}-1024.webp${srcQuery} 1024w`
    : undefined
  // sizes default: estimación conservadora para que el browser no
  // sobre-descargue en mobile. El caller puede pasar sizes específico
  // (e.g. la imagen grande de la ficha de personaje usaría algo mayor).
  const sizesAttr = sizes ?? '(min-width: 1024px) 200px, (min-width: 640px) 160px, 140px'
  const fitClass = className.includes('object-contain') ? 'object-contain' : 'object-cover'
  const positionClass = className.includes('object-center') ? 'object-center' : 'object-top'

  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      style={{ backgroundColor: dominantColor, ...style }}
    >
      <picture>
        {srcsetAvif && (
          <source type="image/avif" srcSet={srcsetAvif} sizes={sizesAttr} />
        )}
        {srcsetWebp && (
          <source type="image/webp" srcSet={srcsetWebp} sizes={sizesAttr} />
        )}
        <img
          src={src}
          alt={alt}
          className={`h-full w-full ${fitClass} ${positionClass} transition-opacity duration-300 motion-reduce:transition-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading={loading ?? 'lazy'}
          decoding={decoding ?? 'async'}
          onLoad={() => setStatus({ src, loaded: true, errored: false })}
          onError={() => setStatus({ src, loaded: false, errored: true })}
          {...imgProps}
        />
      </picture>
    </span>
  )
}

export default PersonajeImg
