// Helpers para resolver variantes de imagen (Plan v2 §3.3-3.4).
//
// El script scripts/generate-image-variants.mjs genera, para cada imagen
// original /img/Anime/slug.webp, seis variantes:
//   slug-300.webp / slug-300.avif
//   slug-600.webp / slug-600.avif
//   slug-1024.webp / slug-1024.avif
//
// Estas funciones devuelven los srcset listos para meter en <source> y el
// fallback final del <img>.

import { imagenPersonaje } from '../lib/personajes-core.js'

const ANCHOS = [300, 600, 1024]

/**
 * Construye los srcset avif+webp + el src fallback a partir del slug.
 * Devuelve null para slugs sin imagen (catalog miss) — el caller decide
 * si renderiza un placeholder o no renderiza nada.
 *
 *   const src = imagenSources('akame')
 *   <picture>
 *     <source type="image/avif" srcSet={src.avif} sizes={src.sizes} />
 *     <source type="image/webp" srcSet={src.webp} sizes={src.sizes} />
 *     <img src={src.fallback} alt="" />
 *   </picture>
 */
export function imagenSources(slug) {
  const original = imagenPersonaje(slug)
  if (!original) return null
  // Quitamos la extensión para construir las variantes con el sufijo de
  // ancho. La original puede ser .webp/.png/.jpg en teoría pero todas
  // las del catálogo son .webp.
  const base = original.replace(/\.[a-z]+$/, '')
  return {
    avif: ANCHOS.map((w) => `${base}-${w}.avif ${w}w`).join(', '),
    webp: ANCHOS.map((w) => `${base}-${w}.webp ${w}w`).join(', '),
    // Sizes hint para que el browser elija el ancho correcto. Pensado
    // para el grid de cards: en mobile 1 columna ≈ 100vw máximo 300px,
    // en tablet 2 columnas ≈ 50vw máximo 600px, en desktop 6 columnas.
    sizes: '(max-width: 640px) 300px, (max-width: 1280px) 600px, 1024px',
    fallback: original,
  }
}
