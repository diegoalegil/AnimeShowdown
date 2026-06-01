import { describe, it, expect } from 'vitest'
import {
  ESTADO_BADGE,
  applyBracketUpdateToTorneoDetalle,
  bumpTorneoResumenVotos,
  getEstadoBadge,
} from './torneosQueries'

// Test only the pure exports (ESTADO_BADGE, getEstadoBadge).
// The hooks (useTorneos, useTorneoBySlug, useVotarEnfrentamiento) are React
// hooks that require React + full context — tested in E2E or integration tests.
// We test the pure helper functions here.

// ─── ESTADO_BADGE ─────────────────────────────────────────────────────────────

describe('ESTADO_BADGE', () => {
  it('exports SCHEDULED mapping', () => {
    expect(ESTADO_BADGE.SCHEDULED).toEqual({
      label: 'Próximamente',
      dot: 'bg-accent',
      color: 'text-gold',
    })
  })

  it('exports IN_PROGRESS mapping', () => {
    expect(ESTADO_BADGE.IN_PROGRESS).toEqual({
      label: 'En curso',
      dot: 'bg-success',
      color: 'text-success',
    })
  })

  it('exports FINISHED mapping', () => {
    expect(ESTADO_BADGE.FINISHED).toEqual({
      label: 'Finalizado',
      dot: 'bg-fg-muted',
      color: 'text-fg-muted',
    })
  })
})

// ─── getEstadoBadge ────────────────────────────────────────────────────────────

describe('getEstadoBadge', () => {
  it('returns SCHEDULED badge for "SCHEDULED"', () => {
    const badge = getEstadoBadge('SCHEDULED')
    expect(badge.label).toBe('Próximamente')
  })

  it('returns IN_PROGRESS badge for "IN_PROGRESS"', () => {
    const badge = getEstadoBadge('IN_PROGRESS')
    expect(badge.label).toBe('En curso')
  })

  it('returns FINISHED badge for "FINISHED"', () => {
    const badge = getEstadoBadge('FINISHED')
    expect(badge.label).toBe('Finalizado')
  })

  it('returns SCHEDULED fallback for unknown estado', () => {
    const badge = getEstadoBadge('UNKNOWN_STATE')
    expect(badge).toEqual(ESTADO_BADGE.SCHEDULED)
  })

  it('returns SCHEDULED fallback for empty/undefined estado', () => {
    expect(getEstadoBadge(undefined)).toEqual(ESTADO_BADGE.SCHEDULED)
    expect(getEstadoBadge('')).toEqual(ESTADO_BADGE.SCHEDULED)
    expect(getEstadoBadge(null as unknown as undefined)).toEqual(ESTADO_BADGE.SCHEDULED)
  })

  it('returns IN_PROGRESS fallback for any unmatched string', () => {
    expect(getEstadoBadge('PENDING')).toEqual(ESTADO_BADGE.SCHEDULED)
    expect(getEstadoBadge('ARCHIVED')).toEqual(ESTADO_BADGE.SCHEDULED)
  })
})

// ─── applyBracketUpdateToTorneoDetalle ────────────────────────────────────────

describe('applyBracketUpdateToTorneoDetalle', () => {
  it('patches only the affected match counts without rebuilding the bracket', () => {
    const torneo = {
      id: 10,
      estado: 'IN_PROGRESS',
      enfrentamientos: [
        {
          id: 1,
          personaje1: { id: 101, nombre: 'A' },
          personaje2: { id: 102, nombre: 'B' },
          personaje1Votos: 2,
          personaje2Votos: 1,
          totalVotos: 3,
        },
        {
          id: 2,
          personaje1: { id: 103, nombre: 'C' },
          personaje2: { id: 104, nombre: 'D' },
          personaje1Votos: 0,
          personaje2Votos: 0,
          totalVotos: 0,
        },
      ],
      currentMatch: {
        id: 1,
        personaje1: { id: 101, nombre: 'A' },
        personaje2: { id: 102, nombre: 'B' },
        personaje1Votos: 2,
        personaje2Votos: 1,
        totalVotos: 3,
      },
    }

    const next = applyBracketUpdateToTorneoDetalle(torneo, {
      enfrentamientoId: 1,
      personaje1Id: 101,
      personaje1Votos: 3,
      personaje2Id: 102,
      personaje2Votos: 1,
      totalVotos: 4,
    })

    expect(next).not.toBe(torneo)
    expect(next.enfrentamientos?.[0]).toMatchObject({
      personaje1Votos: 3,
      personaje2Votos: 1,
      totalVotos: 4,
    })
    expect(next.currentMatch).toMatchObject({
      personaje1Votos: 3,
      personaje2Votos: 1,
      totalVotos: 4,
    })
    expect(next.enfrentamientos?.[1]).toBe(torneo.enfrentamientos[1])
  })

  it('keeps the current cache when the event does not match cached structure', () => {
    const torneo = {
      id: 10,
      estado: 'IN_PROGRESS',
      enfrentamientos: [
        {
          id: 1,
          personaje1: { id: 101 },
          personaje2: { id: 102 },
          personaje1Votos: 2,
          personaje2Votos: 1,
          totalVotos: 3,
        },
      ],
      currentMatch: null,
    }

    expect(applyBracketUpdateToTorneoDetalle(torneo, { enfrentamientoId: 999 })).toBe(torneo)
    expect(applyBracketUpdateToTorneoDetalle(torneo, {
      enfrentamientoId: 1,
      personaje1Id: 999,
      personaje1Votos: 10,
    })).toBe(torneo)
  })
})

// ─── bumpTorneoResumenVotos ───────────────────────────────────────────────────

describe('bumpTorneoResumenVotos', () => {
  it('increments recent vote count for the affected tournament card only', () => {
    const torneos = [
      { slug: 'arena-a', votosUltimos7Dias: 4 },
      { slug: 'arena-b', votosUltimos7Dias: 9 },
    ]

    const next = bumpTorneoResumenVotos(torneos, 'arena-a')

    expect(next).toEqual([
      { slug: 'arena-a', votosUltimos7Dias: 5 },
      { slug: 'arena-b', votosUltimos7Dias: 9 },
    ])
    expect(next?.[1]).toBe(torneos[1])
  })

  it('does not create cache churn when the slug is not present', () => {
    const torneos = [{ slug: 'arena-a', votosUltimos7Dias: 4 }]
    expect(bumpTorneoResumenVotos(torneos, 'missing')).toBe(torneos)
  })
})
