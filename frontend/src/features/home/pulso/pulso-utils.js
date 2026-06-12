/**
 * Helpers puros del bloque vivo de la home (Pulso + hogar del hero).
 * Comparten fichero con la query compartida (pulsoQueries) para que los
 * dos consumidores de la misma cifra no puedan divergir en silencio.
 */

/**
 * Umbral de "comunidad joven": por debajo de este total de votos, las
 * superficies de la home no presentan la cifra como señal consolidada
 * (el Pulso aplica su disclaimer y el hogar enseña copy de arranque en
 * vez del odómetro). Pinneado por test para que Pulso y hero no
 * vuelvan a divergir.
 */
export const UMBRAL_COMUNIDAD_JOVEN = 30

/**
 * Suma de votos all-time del ranking de la comunidad.
 *
 * El endpoint /api/votos/ranking devuelve la lista plana de personajes
 * con votos (FULL_RANKING_LIMIT=5000 > catálogo completo), así que la
 * suma es el total EXACTO de votos emitidos — la cuenta que comparten
 * el disclaimer del Pulso y el odómetro del hogar.
 *
 * @param {Array<{votos?: number}>|undefined|null} ranking
 * @returns {number|null} total de votos, o null si la query aún no resolvió
 */
export function sumarVotosComunidad(ranking) {
  if (!Array.isArray(ranking)) return null
  return ranking.reduce((acc, item) => {
    const votos = Number(item?.votos ?? 0)
    return acc + (Number.isFinite(votos) ? votos : 0)
  }, 0)
}

export function buildDuelVoteUrl(a, b) {
  const slugA = a?.slug
  const slugB = b?.slug
  if (!slugA || !slugB) return '/votar'
  return `/votar?personaje=${encodeURIComponent(slugA)}&rival=${encodeURIComponent(slugB)}`
}
