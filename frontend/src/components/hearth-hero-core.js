/**
 * Derivaciones puras del hogar (HearthHero). Fuera del fichero del
 * componente por la regla react-refresh (solo componentes en .jsx) y
 * para testearlas sin montar nada.
 */

/**
 * Suma de votos all-time del ranking de la comunidad.
 *
 * El endpoint /api/votos/ranking devuelve la lista plana de personajes
 * con votos (FULL_RANKING_LIMIT=5000 > catálogo completo), así que la
 * suma es el total EXACTO de votos emitidos — la misma cuenta que hace
 * SectionPulso para su disclaimer de comunidad joven.
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

/**
 * Torneos actualmente en juego (estado IN_PROGRESS del listado público).
 *
 * @param {Array<{estado?: string}>|undefined|null} torneos
 * @returns {number|null} conteo, o null si la query aún no resolvió
 */
export function contarTorneosEnVivo(torneos) {
  if (!Array.isArray(torneos)) return null
  return torneos.filter((t) => t?.estado === 'IN_PROGRESS').length
}
