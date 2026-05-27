export const sortLabels = {
  popularidad: 'Popularidad',
  elo_desc: 'Mayor ELO',
  elo_asc: 'Menor ELO',
  winrate: 'Mejor win rate',
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
