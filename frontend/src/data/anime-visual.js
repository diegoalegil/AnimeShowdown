import { ANIME_VISUALS, STAGE, makeVisual, withAnimeIdentity } from './visual-assets'
import { getAnimeIdentity } from './anime-identities'

/**
 * Resolutor visual de un anime concreto (combina su entrada curada de
 * ANIME_VISUALS, o un visual generado, con la identidad de anime-identities).
 *
 * Vive en su propio módulo a propósito: `anime-identities` es el dataset más
 * pesado del frontend (~30 KB raw / ~12 KB gz) y antes viajaba en el bundle
 * inicial de TODA la app porque `visual-assets` lo importaba a nivel de módulo
 * para esta única función, y `ErrorBoundary` (estático en App) importa
 * `BRAND_VISUALS` de `visual-assets`. Aislándola aquí, el dataset solo lo
 * arrastran las rutas que de verdad resuelven visuales de anime (catálogo de
 * animes, ficha de anime, ficha de personaje, juegos), todas lazy.
 */
export function getAnimeVisual(slug, anime = slug) {
  const identity = getAnimeIdentity(slug, anime)
  if (ANIME_VISUALS[slug]) return withAnimeIdentity(ANIME_VISUALS[slug], identity)
  const assetSlug = identity.assetSlug || slug
  return withAnimeIdentity(makeVisual({
    slug,
    title: identity.title || anime,
    type: 'anime',
    kanji: identity.kanji,
    fallbackImage: STAGE.animes,
    expectedPath: `/assets/anime-banners/${assetSlug}.webp`,
    cdn: `${slug}-scene-01`,
    paletteSeed: slug,
    accentRgb: identity.accentRgb,
    glowRgb: identity.glowRgb,
    atmosphere: identity.atmosphere,
    mood: identity.copy,
  }), identity)
}
