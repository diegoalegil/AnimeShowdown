import manifest from '../data/brand-assets-manifest.json'

/**
 * Banco de assets de marca servido desde el CDN (R2): tríos por anime
 * (scene 16:9 / prop 4:5 / symbol 1:1), arte de juegos, share-frames y
 * fondos globales. Los archivos NO viven en git ni en el build — el
 * manifest (generado al subir la tanda) es la única verdad de qué existe
 * y con qué variantes responsive.
 *
 * URLs absolutas al CDN a propósito: funcionan igual en dev, preview y
 * prod, y evitan el salto 302 de /img/*.
 */

const BASE: string = manifest.base
const FILES: Record<string, number[]> = manifest.files

export interface BrandImage {
  src: string
  srcSet?: string
  widths: number[]
}

/** URL del asset (opcionalmente de una variante) o null si no existe. */
export function brandAssetUrl(name: string, width?: number): string | null {
  const widths = FILES[name]
  if (!widths) return null
  if (width && widths.includes(width)) return `${BASE}/${name}-${width}.webp`
  return `${BASE}/${name}.webp`
}

/** src + srcSet responsivo del asset, o null si no existe en el manifest. */
export function brandImage(name: string): BrandImage | null {
  const widths = FILES[name]
  if (!widths) return null
  const src = `${BASE}/${name}.webp`
  if (widths.length === 0) return { src, widths: [] }
  const srcSet = [
    ...widths.map((w) => `${BASE}/${name}-${w}.webp ${w}w`),
    // El original cubre el tramo por encima de la variante más grande.
    `${BASE}/${name}.webp 1600w`,
  ].join(', ')
  return { src, srcSet, widths }
}

/** Trío de un anime por su slug canónico del catálogo. */
export function animeBrandAssets(animeSlug: string) {
  const scene = brandImage(`${animeSlug}-scene-01`)
  const prop = brandImage(`${animeSlug}-prop-01`)
  const symbol = brandImage(`${animeSlug}-symbol-01`)
  if (!scene && !prop && !symbol) return null
  return { scene, prop, symbol }
}

/** Arte de un juego (anigrid, oraculo, elo-duel, nexo-anime, ...). */
export function gameBrandAssets(gameKey: string) {
  const cover = brandImage(`${gameKey}-cover`)
  const background = brandImage(`${gameKey}-background`)
  const resultCard = brandImage(`${gameKey}-result-card`)
  if (!cover && !background && !resultCard) return null
  return { cover, background, resultCard }
}
