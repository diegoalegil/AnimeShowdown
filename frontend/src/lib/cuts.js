// Recortes transparentes generados en frontend/img/cuts/{slug}.webp.
// import.meta.glob deja a Vite construir un Set de slugs existentes sin
// descargar ni inyectar las 800+ imágenes en el bundle inicial.
const cutModules = import.meta.glob('../../img/cuts/*.webp')

const CUT_SLUGS = new Set(
  Object.keys(cutModules).map((path) =>
    path
      .split('/')
      .pop()
      .replace(/\.webp$/i, ''),
  ),
)

export function hasCut(slug) {
  return Boolean(slug && CUT_SLUGS.has(slug))
}

export function cutUrl(slug) {
  return `/img/cuts/${slug}.webp`
}
