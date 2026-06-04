/**
 * <picture> responsive para portadas/banners de marca (heroes, catalogs,
 * banners de anime/torneo, covers de juegos/eventos). Sustituye al
 * `background-image` CSS que impedía lazy-loading, srcset y fetchPriority.
 *
 * Sirve AVIF (preferido) → WebP → <img> original como fallback. Los srcset
 * (480/768/1280) los calcula `makeVisual` desde el manifest, así que en móvil
 * el navegador descarga la variante pequeña en vez del original 1600px.
 *
 * Uso típico (fondo a sangre de un contenedor `relative`):
 *   <ResponsivePicture visual={visual} className="absolute inset-0 opacity-85"
 *                      sizes="100vw" loading="eager" fetchPriority="high" />
 *
 * - `visual`: objeto de makeVisual (lee image, imageAvifSrcset, imageWebpSrcset,
 *   objectPosition). También se puede pasar `src`/`avifSrcset`/`webpSrcset`
 *   sueltos para usos sin visual.
 * - LCP: pasar `loading="eager"` + `fetchPriority="high"`. Below-fold: dejar el
 *   default `loading="lazy"`.
 */
function ResponsivePicture({
  visual,
  src,
  avifSrcset,
  webpSrcset,
  sizes = '100vw',
  objectFit = 'cover',
  objectPosition,
  fetchPriority,
  loading = 'lazy',
  decoding = 'async',
  alt = '',
  className = '',
  style,
  imgClassName = '',
  width,
  height,
  ...rest
}) {
  const imgSrc = src ?? visual?.image ?? null
  if (!imgSrc) return null
  const avif = avifSrcset ?? visual?.imageAvifSrcset ?? null
  const webp = webpSrcset ?? visual?.imageWebpSrcset ?? null
  const position = objectPosition ?? visual?.objectPosition ?? 'center'

  return (
    <picture className={`block ${className}`} style={style} aria-hidden={alt === '' ? 'true' : undefined}>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      <img
        src={imgSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        className={`h-full w-full ${imgClassName}`}
        style={{ objectFit, objectPosition: position }}
        {...rest}
      />
    </picture>
  )
}

export default ResponsivePicture
