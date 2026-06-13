/**
 * Derivaciones puras del hogar (HearthHero). Fuera del fichero del
 * componente por la regla react-refresh (solo componentes en .jsx) y
 * para testearlas sin montar nada. La suma de votos de la comunidad
 * vive en features/home/pulso/pulso-utils.js (compartida con el Pulso).
 */

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

/**
 * Torneos programados (SCHEDULED): el segundo nivel del estado vacío —
 * con 0 en juego pero N programados, el hogar dice "N a punto de
 * empezar" en vez de invitar a encender el primero.
 *
 * @param {Array<{estado?: string}>|undefined|null} torneos
 * @returns {number|null} conteo, o null si la query aún no resolvió
 */
export function contarTorneosProgramados(torneos) {
  if (!Array.isArray(torneos)) return null
  return torneos.filter((t) => t?.estado === 'SCHEDULED').length
}
