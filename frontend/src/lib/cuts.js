import { CUT_SLUGS } from '../data/cut-slugs'

// Recortes transparentes generados en frontend/img/cuts/{slug}.webp.
// Mantener esto como manifest explícito evita que Vite/Rolldown cree miles
// de módulos virtuales solo para saber si un recorte existe. El archivo
// incluye únicamente slugs base, no variantes -300/-600/-1024.
const CUT_SLUG_SET = new Set(CUT_SLUGS)


export function hasCut(slug) {
  return Boolean(slug && CUT_SLUG_SET.has(slug))
}

export function cutUrl(slug) {
  return `/img/cuts/${slug}.webp`
}
