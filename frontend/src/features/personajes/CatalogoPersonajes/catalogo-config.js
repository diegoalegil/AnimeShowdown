// El "win rate" salía de stats sintéticos (getStatsPersonaje) y no de votos
// reales, así que se retira como criterio de orden (ver decisión "ocultar W/L
// sintéticos"). Los órdenes por ELO se etiquetan "base" porque ese ELO es una
// estimación por popularidad, no el ranking competitivo real de /ranking.
export const sortLabels = {
  popularidad: 'Popularidad',
  elo_desc: 'Mayor ELO base',
  elo_asc: 'Menor ELO base',
  nombre_az: 'Nombre A-Z',
  nombre_za: 'Nombre Z-A',
  anime: 'Anime A-Z',
}

export const DEFAULT_SORT = 'popularidad'
export const DEFAULT_VIEW = 'grid'

export function parseOptionalInt(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}
