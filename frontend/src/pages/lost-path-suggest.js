// Heurística de sugerencia del 404 (pieza 100, LostPath): si la URL parece un slug
// de personaje mal escrito (/personajes/<slug>), proponemos el match más
// cercano del catálogo YA cargado. Sin nuevas deps: distancia de edición
// casera + umbral de confianza ALTA para no sugerir basura.

const PERSONAJE_PATH = /^\/personajes\/([^/?#]+)\/?$/

/**
 * Distancia de Levenshtein (iterativa, una fila → O(min) memoria). Suficiente
 * para comparar slugs cortos contra un catálogo de cientos de entradas.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  let prev = new Array(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j
  for (let i = 1; i <= al; i++) {
    const cur = [i]
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[bl]
}

/**
 * Extrae el slug intentado si el pathname parece /personajes/<slug> (un solo
 * segmento, sin query/hash). Si no encaja, null → 404 genérico.
 * @param {string} pathname
 * @returns {?string}
 */
export function extractPersonajeSlug(pathname) {
  if (typeof pathname !== 'string') return null
  // Defensivo: useLocation().pathname no trae query/hash, pero si alguien pasa
  // un path completo lo recortamos para no fallar el match por el sufijo.
  const path = pathname.split(/[?#]/)[0]
  const m = PERSONAJE_PATH.exec(path)
  if (!m) return null
  try {
    return decodeURIComponent(m[1]).toLowerCase()
  } catch {
    return m[1].toLowerCase()
  }
}

// Umbral de confianza ALTA: similitud normalizada = 1 - dist/maxLen. Solo
// sugerimos si >= 0.72 (p.ej. "narduto"→"naruto" ≈ 0.86 sí; "zzzzzz" contra
// cualquiera, no). Además exigimos dist absoluta <= 4 para que un slug muy
// largo con similitud relativa engañosa no cuele una sugerencia mala.
export const SUGGEST_THRESHOLD = 0.72
export const SUGGEST_MAX_DIST = 4

/**
 * Devuelve el personaje del catálogo más parecido al slug mal escrito de la
 * URL, SOLO si supera el umbral de confianza alta. Si la URL no es de
 * personaje, el catálogo está vacío, no hay match fiable, o el slug existe
 * exacto (no es un typo), devuelve null.
 * @param {string} pathname
 * @param {Array<{slug?: string, nombre?: string}>} personajes
 * @returns {?{slug: string, nombre?: string}}
 */
export function suggestPersonaje(pathname, personajes) {
  const slug = extractPersonajeSlug(pathname)
  if (!slug || !Array.isArray(personajes) || personajes.length === 0) return null

  let best = null
  for (const p of personajes) {
    const pslug = (p?.slug ?? '').toLowerCase()
    if (!pslug) continue
    if (pslug === slug) return null // existe exacto → no es un 404 de typo
    const dist = levenshtein(slug, pslug)
    const sim = 1 - dist / Math.max(slug.length, pslug.length)
    if (!best || sim > best.sim) best = { personaje: p, sim, dist }
  }

  if (best && best.sim >= SUGGEST_THRESHOLD && best.dist <= SUGGEST_MAX_DIST) {
    return best.personaje
  }
  return null
}
