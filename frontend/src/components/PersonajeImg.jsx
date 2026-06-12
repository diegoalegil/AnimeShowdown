import { useCallback, useEffect, useState } from 'react'
import { encodeImageUrl } from '../lib/personaje-img-srcset'
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
// WebKit crea un <img> nuevo y el fade de primera aparición volvería a correr
// sobre una imagen ya vista: parpadeo en blanco de la silueta (solo Safari).
// Recordando los srcs ya cargados, el remonte se pinta sin fade. V-4.
// Desde V-5 este Set solo decide el fade COSMÉTICO (.as-img-reveal): la
// visibilidad del <img> nunca depende de él ni de ningún estado JS.
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
 *
 * <p>Contrato de visibilidad (V-5): el {@code <img>} es SIEMPRE visible.
 * Nada de gates {@code opacity-0} dependientes del load-event de React:
 * en Safari, con {@code loading="lazy"} bajo {@code content-visibility:auto},
 * el evento puede perderse y la carta quedaba atascada en el color dominante
 * hasta recargar. Un {@code <img>} sin datos no pinta nada, así que el span
 * con el color dominante hace de placeholder igual; el fade de primera
 * aparición corre por CSS ({@code .as-img-reveal} con {@code @starting-style},
 * que degrada a "sin fade" donde no hay soporte — nunca a "invisible").
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
  const [status, setStatus] = useState({ src: null, errored: false })
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
  if (status.src !== null && status.src !== src) {
    setStatus({ src: null, errored: false })
  }
  const errored = status.src === src && status.errored
  // Fade cosmético solo en la PRIMERA aparición del src en la sesión: en un
  // remonte de un src ya visto (tilt de PersonajeCard, etc.) repetir el fade
  // se percibe como parpadeo de la silueta en WebKit (V-3/V-4). Se evalúa por
  // render a propósito: aunque cambie tras onLoad, quitar la clase con la
  // transición ya completada no produce ningún cambio visual.
  const reveal = !loadedSrcs.has(src)
  const dominantColor =
    colorDominante ?? imagenColorDominante ?? p?.imagenColorDominante ?? 'var(--color-surface)'
  const altText = alt ?? nombre ?? p?.nombre ?? slug
  const handleImageLoad = useCallback((event) => {
    loadedSrcs.add(src)
    onLoad?.(event)
  }, [onLoad, src])
  const handleImageError = useCallback((event) => {
    setStatus({ src, errored: true })
    trackAssetError({
      src: event.currentTarget?.currentSrc || src,
      category: 'character',
      slug,
    })
    onError?.(event)
  }, [onError, slug, src])
  // Si la imagen ya estaba completa al attachear (cache del navegador: el
  // load nativo pudo dispararse antes de que React enganche su listener
  // sintético), registrarla igualmente para que futuros remontes no fadeen.
  const handleImageRef = useCallback(
    (node) => {
      if (node?.complete && node.naturalWidth > 0) loadedSrcs.add(src)
    },
    [src],
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
          className={`h-full w-full ${fitClass} ${positionClass}${reveal ? ' as-img-reveal' : ''}`}
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
