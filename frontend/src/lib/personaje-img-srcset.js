/**
 * Gramática de URLs responsive del arte de personajes — ÚNICA fuente de
 * verdad, compartida entre PersonajeImg (el <picture> real) y el warm de
 * imágenes del prefetch de /votar (que debe pedir EXACTAMENTE la misma URL
 * para acertar la caché HTTP).
 *
 * Variantes generadas: `<base>-300.webp` y `<base>-600.webp`; el original
 * solo entra como candidato por encima de 600w.
 */

export function encodeImageUrl(url) {
  if (!url || /^(data|blob):/i.test(url)) return url
  return encodeURI(url).replace(/,/g, '%2C')
}

/**
 * srcset WebP idéntico al que monta PersonajeImg para un src dado.
 * @returns {string|undefined} undefined si el src no es .webp (sin variantes).
 */
export function buildWebpSrcset(src, maxSourceWidth = 600) {
  if (!src) return undefined
  const queryIndex = src.indexOf('?')
  const srcPath = queryIndex === -1 ? src : src.slice(0, queryIndex)
  const srcQuery = queryIndex === -1 ? '' : src.slice(queryIndex)
  const base = srcPath.replace(/(?:-(?:300|600|1024))?\.webp$/i, '')
  if (!/\.webp$/i.test(srcPath)) return undefined
  const sourceWidthLimit = Number(maxSourceWidth)
  const safeSourceWidthLimit = Number.isFinite(sourceWidthLimit)
    ? Math.max(300, Math.round(sourceWidthLimit))
    : 600
  const variantWidths = [300, 600].filter((width) => width <= safeSourceWidthLimit)
  const includeOriginalCandidate = safeSourceWidthLimit > 600
  return [
    ...variantWidths.map(
      (width) => `${encodeImageUrl(`${base}-${width}.webp${srcQuery}`)} ${width}w`,
    ),
    ...(includeOriginalCandidate
      ? [`${encodeImageUrl(src)} ${Math.max(1024, safeSourceWidthLimit)}w`]
      : []),
  ].join(', ')
}

/**
 * Precalienta el arte de un personaje con el MISMO srcset/sizes que pintará
 * el <picture> destino: el navegador elige idéntica candidata (mismo DPR y
 * viewport) y la descarga aterriza en caché HTTP antes del swap. Fire and
 * forget; sin efectos sobre React Query.
 */
export function warmPersonajeImage(src, sizes) {
  if (!src || typeof Image === 'undefined') return
  const img = new Image()
  const srcset = buildWebpSrcset(src)
  if (srcset) {
    img.srcset = srcset
    if (sizes) img.sizes = sizes
  }
  img.src = encodeImageUrl(src)
}
