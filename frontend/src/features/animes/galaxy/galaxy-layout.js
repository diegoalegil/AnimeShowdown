/**
 * galaxy-layout.js — espiral galáctica determinista de los universos.
 *
 * Puro JS (sin three, sin React) para que lo compartan la galaxia WebGL y el
 * póster 2D de fallback. La data real la arma `construir-universos.js`.
 */

/** ¿El navegador soporta WebGL? (decide galaxia 3D vs póster 2D, sin cargar three). */
export function supportsWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Glifo de placeholder: kanji REAL del universo si existe; si no, inicial. */
export function glyphFor(u) {
  if (u.kanji) return u.kanji
  const clean = u.name.replace(/^(the|el|la|a)\s+/i, '')
  return clean.charAt(0).toUpperCase()
}

/** PRNG determinista (misma galaxia en cada visita). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * Espiral galáctica de 3 brazos con grosor real en Y.
 * Los top (rank 1..N) ocupan su propia espiral dorada cerca del núcleo y DEBEN
 * venir primero en el array `universes`.
 * Devuelve [{ universe, index, x, y, z, scale, top, seed }]
 */
export function buildGalaxyLayout(universes, { arms = 3, seed = 7 } = {}) {
  const rand = mulberry32(seed)
  const rest = universes.filter((u) => !u.top).length || 1
  let k = 0 // contador solo de no-top
  return universes.map((u, i) => {
    const top = !!u.top
    let x, y, z, scale
    if (top) {
      const j = i // los top vienen primero (rank 1..N)
      const r = 4.4 + j * 0.95
      const a = j * GOLDEN + (rand() - 0.5) * 0.2
      x = Math.cos(a) * r
      z = Math.sin(a) * r
      y = (rand() - 0.5) * 1.6
      scale = 2.35 + rand() * 0.35
    } else {
      const t = k / rest
      k += 1
      const arm = k % arms
      const r = 7.5 + 24.5 * Math.pow(t, 0.82) + (rand() - 0.5) * 2.2
      const a = arm * ((Math.PI * 2) / arms) + Math.pow(t, 0.95) * 4.4 + (rand() - 0.5) * 0.42
      x = Math.cos(a) * r
      z = Math.sin(a) * r
      y = (rand() - 0.5) * (3.4 * (1 - t * 0.55))
      scale = 1.2 + rand() * 0.6
    }
    return { universe: u, index: i, x, y, z, scale, top, seed: rand() }
  })
}
