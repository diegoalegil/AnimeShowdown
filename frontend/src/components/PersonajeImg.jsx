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

// Srcs que ya cargaron con éxito en esta sesión. Cuando un <img> se remonta
// —p.ej. PersonajeCard arma el tilt al primer hover y reemplaza el subárbol—
// WebKit crea un <img> nuevo cuyo `complete` es false aunque la imagen esté en
// cache, así que el ref-callback no detecta el cacheo y se re-dispara el fade
// opacity 0→1: se ve un parpadeo en blanco de la silueta (solo en Safari).
// Recordando los srcs ya cargados, en el remonte pintamos a opacidad plena sin
// fade (instant) desde el primer frame y el flash desaparece. V-4.
const loadedSrcs = new Set()
const FIT_CLASSES = {
  contain: 'object-contain',
  cover: 'object-cover',
}
const POSITION_CLASSES = {
  bottom: 'object-bottom',
  center: 'object-center',
  top: 'object-top',
}

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
 * 300/600 se sirven desde assets generados. El original pesado queda fuera
 * del srcset por defecto para que cartas y duelos no descarguen 1024w salvo
 * que un caller grande suba explícitamente `maxSourceWidth`.
 *
 * <p>Lazy loading y async decoding por default. El caller puede override
 * (p.ej. {@code loading="eager" fetchPriority="high"} para LCP).
 */
function PersonajeImg({
  slug,
  alt,
  sizes,
  fit,
  position,
  maxSourceWidth = 600,
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
  // Dimensiones intrínsecas (ratio 2:3 de carta) para que el navegador reserve
  // el espacio y no haya CLS aunque el contenedor no fije aspecto. El CSS
  // (h-full w-full) sigue mandando en el tamaño real; solo importa la proporción.
  // Overridable por el caller para usos no-2:3.
  width = 400,
  height = 600,
  ...imgProps
}) {
  const [status, setStatus] = useState({ src: null, loaded: false, errored: false, instant: false })
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
  if (status.src !== src) {
    if (loadedSrcs.has(src)) {
      // Ya cargó antes en esta sesión: pinta instantánea a opacidad plena sin
      // fade, aunque sea un remonte (evita el parpadeo en blanco de WebKit).
      setStatus({ src, loaded: true, errored: false, instant: true })
    } else if (status.src !== null) {
      setStatus({ src: null, loaded: false, errored: false, instant: false })
    }
  }
  const loaded = status.src === src && status.loaded
  const errored = status.src === src && status.errored
  // Imagen ya completa al montar (cache del navegador): pintar a opacidad
  // plena SIN el fade opacity 0→1. En un remonte —p.ej. PersonajeCard arma el
  // tilt al primer hover y reemplaza el subárbol— ese fade se percibe como un
  // parpadeo de la silueta (la imagen desaparece y reaparece). V-3.
  const instant = status.src === src && status.instant
  const dominantColor =
    colorDominante ?? imagenColorDominante ?? p?.imagenColorDominante ?? 'var(--color-surface)'
  const altText = alt ?? nombre ?? p?.nombre ?? slug
  const handleImageLoad = useCallback((event) => {
    loadedSrcs.add(src)
    setStatus({ src, loaded: true, errored: false, instant: false })
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
        // Cacheada: marcar instant para pintar a opacidad plena sin fade.
        loadedSrcs.add(src)
        setStatus({ src, loaded: true, errored: false, instant: true })
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
  const base = srcPath.replace(/(?:-(?:300|600|1024))?\.webp$/i, '')
  const isWebp = /\.webp$/i.test(srcPath)
  const imgSrc = encodeImageUrl(src)
  const sourceWidthLimit = Number(maxSourceWidth)
  const safeSourceWidthLimit = Number.isFinite(sourceWidthLimit)
    ? Math.max(300, Math.round(sourceWidthLimit))
    : 600
  const variantWidths = [300, 600].filter((width) => width <= safeSourceWidthLimit)
  const includeOriginalCandidate = safeSourceWidthLimit > 600
  const srcsetWebp = isWebp
    ? [
        ...variantWidths.map((width) => `${encodeImageUrl(`${base}-${width}.webp${srcQuery}`)} ${width}w`),
        ...(includeOriginalCandidate ? [`${imgSrc} ${Math.max(1024, safeSourceWidthLimit)}w`] : []),
      ].join(', ')
    : undefined
  // sizes default: estimación conservadora para que el browser no
  // sobre-descargue en mobile. El caller puede pasar sizes específico
  // (e.g. la imagen grande de la ficha de personaje usaría algo mayor).
  const sizesAttr = sizes ?? '(min-width: 1024px) 200px, (min-width: 640px) 160px, 140px'
  const fitClass = FIT_CLASSES[fit]
    ?? (className.includes('object-contain') ? 'object-contain' : 'object-cover')
  const positionClass = POSITION_CLASSES[position]
    ?? (className.includes('object-center')
      ? 'object-center'
      : className.includes('object-bottom')
        ? 'object-bottom'
        : 'object-top')

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
          width={width}
          height={height}
          className={`h-full w-full ${fitClass} ${positionClass} ${
            loaded && instant ? '' : 'transition-opacity duration-300 motion-reduce:transition-none'
          } ${loaded ? 'opacity-100' : 'opacity-0'}`}
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
