/**
 * Derivaciones puras del expediente (/mi-ranking) — fuera del componente
 * para testearlas sin montar nada.
 */

/**
 * Construye las entries del dossier desde el top del ranking local.
 *
 * Ranking 1224: mismos votos ⇒ comparten puesto y el siguiente número
 * se omite (1, 2, 2, 4...). El orden de entrada (stats.top, votos desc)
 * se conserva.
 *
 * @param {Array<{slug: string, nombre?: string, anime?: string, count: number}>} top
 *        stats.top de getLocalVoteStats (ya ordenado por votos desc).
 * @param {Map<string, object>} catalogBySlug   slug → personaje del catálogo.
 * @param {Map<string, number>} [globalBySlug]  slug → posición global (1-based).
 * @returns {Array<{slug, name, anime, yourRank, globalRank, colorDominante}>}
 */
export function buildDossierEntries(top, catalogBySlug, globalBySlug) {
  let lastCount = null
  let lastRank = 0
  return top.map((item, i) => {
    const yourRank = item.count === lastCount ? lastRank : i + 1
    lastCount = item.count
    lastRank = yourRank
    const personaje = catalogBySlug.get(item.slug)
    return {
      slug: item.slug,
      // || y no ??: normalizeVote rellena nombre/anime ausentes con ''.
      name: item.nombre || personaje?.nombre || item.slug,
      anime: item.anime || personaje?.anime || '',
      yourRank,
      globalRank: globalBySlug?.get(item.slug) ?? null,
      colorDominante: personaje?.imagenColorDominante,
    }
  })
}

/**
 * Slug del voto recién emitido (vuelta de /votar): el ganador del último
 * voto local si ocurrió hace menos de la ventana. Su placa late UNA vez.
 *
 * @param {Array<{ganadorSlug?: string, at?: string|number}>} votes  votos
 *        locales (at = ISO string según recordLocalVote; tolera epoch ms).
 * @param {number} now           epoch ms (se pasa desde un callback, no render).
 * @param {number} [windowMs]    ventana de "reciente" (default 3 min).
 * @returns {string|null}
 */
export function computeRecentVoteSlug(votes, now, windowMs = 3 * 60 * 1000) {
  if (!Array.isArray(votes) || votes.length === 0) return null
  let last = null
  for (const v of votes) {
    if (!v?.ganadorSlug) continue
    const at = typeof v.at === 'number' ? v.at : Date.parse(v.at)
    if (!Number.isFinite(at)) continue
    if (!last || at > last.at) last = { at, slug: v.ganadorSlug }
  }
  if (!last) return null
  return now - last.at <= windowMs ? last.slug : null
}

/**
 * Mapa slug → posición global desde la respuesta de /api/votos/ranking.
 * Usa `posicion` si el backend la sirve; si no, el índice 1-based.
 *
 * @param {Array<{personaje?: {slug?: string}, posicion?: number}>|undefined} ranking
 * @returns {Map<string, number>}
 */
export function buildGlobalRankMap(ranking) {
  const map = new Map()
  if (!Array.isArray(ranking)) return map
  ranking.forEach((item, i) => {
    const slug = item?.personaje?.slug
    if (!slug || map.has(slug)) return
    map.set(slug, Number.isFinite(item?.posicion) ? item.posicion : i + 1)
  })
  return map
}
