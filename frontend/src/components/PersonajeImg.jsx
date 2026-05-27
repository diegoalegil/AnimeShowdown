import { useCallback, useEffect, useState } from 'react'
import {
  CATALOGO_PERSONAJES_HYDRATED_EVENT,
  MISSING_IMAGE_PREFIX,
  getPersonajeBySlug,
  imagenPersonaje,
} from '../lib/personajes-core'
import { trackAssetError } from '../lib/asset-tracking'
import AssetFallback from './AssetFallback'
import PersonajePlaceholder from './PersonajePlaceholder'

function encodeImageUrl(url) {
  if (!url || /^(data|blob):/i.test(url)) return url
  return encodeURI(url).replace(/,/g, '%2C')
}

/**
 * <img> de personaje con fallback premium + responsive.
 *
 * <p>Si la imagen real falla (404, slug sin imagen, error de red…) renderiza
 * un {@link PersonajePlaceholder} en su lugar — iniciales, anime y kanji
 * decorativo. Nunca se muestra el icono de imagen rota del navegador.
 *
 * <p>Performance: usa {@code <picture>} con srcset WebP. Las variantes
 * 300/600 se sirven desde assets generados y el WebP original actúa como
 * candidato grande. AVIF se genera localmente pero no se sube, así que no
 * se referencia desde producción.
 *
 * <p>Lazy loading y async decoding por default. El caller puede override
 * (p.ej. {@code loading="eager" fetchPriority="high"} para LCP).
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
  onLoad,
  onError,
  ...imgProps
}) {
  const [status, setStatus] = useState({ src: null, loaded: false, errored: false })
  // Tick para forzar rerender cuando el catálogo de personajes se hidrata
  // (evento CATALOGO_PERSONAJES_HYDRATED_EVENT). Antes de hidratarse,
  // imagenPersonaje(slug) cae a `/img/_missing/${slug}.webp` y dispara
  // onError → la card queda atrapada en PersonajePlaceholder aunque la
  // imagen real exista. Al rerendear tras la hidratación, src cambia al
  // path correcto y reseteamos el status (ver más abajo).
  const [, setHydrationTick] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onHydrated = () => setHydrationTick((tick) => tick + 1)
    window.addEventListener(CATALOGO_PERSONAJES_HYDRATED_EVENT, onHydrated)
    return () =>
      window.removeEventListener(CATALOGO_PERSONAJES_HYDRATED_EVENT, onHydrated)
  }, [])
  const p = getPersonajeBySlug(slug)
  const src = srcOverride ?? imagenPersonaje(slug)
  // Reset del status durante render cuando src cambia (patrón oficial de
  // React para "derived state"). Cubre dos casos:
  //   - imagenPersonaje(slug) cambia de null → path real al hidratarse
  //     el catálogo. Sin reset, un errored=true previo dejaría el
  //     componente atrapado en PersonajePlaceholder.
  //   - El slug cambia (caso poco común pero el componente debería
  //     soportarlo: e.g. carousel que reusa la misma instancia).
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (status.src !== src && status.src !== null) {
    setStatus({ src: null, loaded: false, errored: false })
  }
  const loaded = status.src === src && status.loaded
  const errored = status.src === src && status.errored
  const dominantColor =
    colorDominante ?? imagenColorDominante ?? p?.imagenColorDominante ?? '#151923'
  const altText = alt ?? nombre ?? p?.nombre ?? slug
  const handleImageLoad = useCallback((event) => {
    setStatus({ src, loaded: true, errored: false })
    onLoad?.(event)
  }, [onLoad, src])
  const handleImageError = useCallback((event) => {
    setStatus({ src, loaded: false, errored: true })
    trackAssetError({
      src: event.currentTarget?.currentSrc || src,
      category: 'character',
      slug,
    })
    onError?.(event)
  }, [onError, slug, src])
  const handleImageRef = useCallback(
    (node) => {
      if (!node || loaded || errored) return
      if (node.complete && node.naturalWidth > 0) {
        setStatus({ src, loaded: true, errored: false })
      }
    },
    [errored, loaded, src],
  )

  // Catálogo no hidratado todavía: imagenPersonaje(slug) devolvió el path
  // sentinel /img/_missing/${slug}.webp y no se pasó un srcOverride real.
  // En vez de pintar <img> contra ese path (404 → onError → errored=true
  // → PersonajePlaceholder permanente), mostramos solo el background con
  // el dominantColor como skeleton. Cuando llegue el catálogo, el evento
  // CATALOGO_PERSONAJES_HYDRATED_EVENT dispara rerender, src deja de tener
  // el prefijo sentinel y el <picture>/<img> entra a jugar. Cero 404s,
  // cero placeholders fantasma.
  const isPlaceholderSrc = !src || src.startsWith(MISSING_IMAGE_PREFIX)
  if (isPlaceholderSrc) {
    return (
      <AssetFallback
        slug={slug}
        anime={p?.anime}
        dominantColor={dominantColor}
        kind="character"
        label={altText}
        className={className}
        style={style}
      />
    )
  }

  if (errored) {
    return (
      <PersonajePlaceholder
        nombre={p?.nombre ?? nombre ?? slug}
        anime={p?.anime ?? 'Anime desconocido'}
        className={className}
      />
    )
  }

  // Variantes responsive desde el src original. Cloudflare Pages solo recibe
  // las variantes WebP trackeadas; AVIF está ignorado en git.
  const queryIndex = src.indexOf('?')
  const srcPath = queryIndex === -1 ? src : src.slice(0, queryIndex)
  const srcQuery = queryIndex === -1 ? '' : src.slice(queryIndex)
  const base = srcPath.replace(/\.webp$/i, '')
  const isWebp = /\.webp$/i.test(srcPath)
  const imgSrc = encodeImageUrl(src)
  const srcsetWebp = isWebp
    ? [
        `${encodeImageUrl(`${base}-300.webp${srcQuery}`)} 300w`,
        `${encodeImageUrl(`${base}-600.webp${srcQuery}`)} 600w`,
        `${imgSrc} 1024w`,
      ].join(', ')
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
        {srcsetWebp && (
          <source type="image/webp" srcSet={srcsetWebp} sizes={sizesAttr} />
        )}
        <img
          ref={handleImageRef}
          src={imgSrc}
          alt={altText}
          className={`h-full w-full ${fitClass} ${positionClass} transition-opacity duration-300 motion-reduce:transition-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading={loading ?? 'lazy'}
          decoding={decoding ?? 'async'}
          {...imgProps}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </picture>
    </span>
  )
}

export default PersonajeImg
