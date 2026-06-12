import { getTournamentVisual } from '../../data/visual-assets'

/**
 * Modelo de fase y sellos del cartel de torneo (TournamentPoster). Vive en
 * módulo hermano para que el .jsx solo exporte componentes (fast-refresh).
 */

export const FASES = [
  { id: 'inscripcion', label: 'Inscripción' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'eliminatorias', label: 'Eliminatorias' },
  { id: 'final', label: 'Final' },
]

/** Sello hanko por estado: kanji real con significado, no decoración. */
export const SELLOS = {
  SCHEDULED: {
    kanji: '募',
    titulo: 'Inscripción abierta',
    chip: 'border-gold/70 text-gold-bright',
    fondo: 'var(--color-gold-soft)',
  },
  IN_PROGRESS: {
    kanji: '戦',
    titulo: 'En juego',
    chip: 'border-hanko/80 text-hanko',
    fondo: 'color-mix(in srgb, var(--color-hanko) 12%, transparent)',
  },
  FINISHED: {
    kanji: '終',
    titulo: 'Cerrado',
    chip: 'border-border text-fg-muted',
    fondo: 'color-mix(in srgb, var(--color-fg-strong) 3%, transparent)',
  },
}

/**
 * Índice de fase actual. SCHEDULED siempre está en inscripción; FINISHED ya
 * recorrió todo el camino. En juego: lo deriva de rondaActual/totalRondas
 * (última ronda = final, penúltima = eliminatorias, resto = grupos).
 */
export function deriveFaseActual(torneo) {
  if (torneo.estado === 'SCHEDULED') return 0
  if (torneo.estado === 'FINISHED') return FASES.length
  const { rondaActual, totalRondas } = torneo
  if (!rondaActual || !totalRondas) return 1
  if (rondaActual >= totalRondas) return 3
  if (rondaActual >= totalRondas - 1) return 2
  return 1
}

/**
 * TorneoResumenDto → props del cartel. El backend no manda visual, campeón
 * resuelto ni próximo hito: el visual sale del banco de marca por slug, el
 * nombre del campeón de avataresPrincipales (ya viene resuelto para la card)
 * y el único hito con fecha real que tenemos es el arranque de un SCHEDULED.
 * Sin fecha no hay cuenta atrás — el cartel lo omite, no se inventa nada.
 */
export function adaptTorneoParaPoster(torneo) {
  const ganadorNombre = torneo.ganadorSlug
    ? (torneo.avataresPrincipales?.find((p) => p.slug === torneo.ganadorSlug)?.nombre ?? null)
    : null
  const proximoHito =
    torneo.estado === 'SCHEDULED' && torneo.fechaInicio
      ? { label: 'Arranca en', fecha: torneo.fechaInicio }
      : null
  return {
    ...torneo,
    visual: getTournamentVisual(torneo.slug, torneo.nombre),
    ganadorNombre,
    proximoHito,
  }
}
