import { CUT_SLUGS } from '../data/cut-slugs'

// Recortes transparentes generados en frontend/img/cuts/{slug}.webp.
// Mantener esto como manifest explícito evita que Vite/Rolldown cree miles
// de módulos virtuales solo para saber si un recorte existe. El archivo
// incluye únicamente slugs base, no variantes -300/-600/-1024.
const CUT_SLUG_SET = new Set(CUT_SLUGS)
const CUT_ASSET_SLUG_ALIASES = {
  l: 'L',
}

function resolveCutAssetSlug(slug) {
  return CUT_SLUG_SET.has(slug) ? slug : CUT_ASSET_SLUG_ALIASES[slug]
}

export function hasCut(slug) {
  return Boolean(slug && resolveCutAssetSlug(slug))
}

export function cutUrl(slug) {
  return `/img/cuts/${resolveCutAssetSlug(slug) ?? slug}.webp`
}
