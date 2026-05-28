import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ESTADO_BADGE,
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
      dot: 'bg-emerald-400',
      color: 'text-emerald-400',
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
    expect(getEstadoBadge(null)).toEqual(ESTADO_BADGE.SCHEDULED)
  })

  it('returns IN_PROGRESS fallback for any unmatched string', () => {
    expect(getEstadoBadge('PENDING')).toEqual(ESTADO_BADGE.SCHEDULED)
    expect(getEstadoBadge('ARCHIVED')).toEqual(ESTADO_BADGE.SCHEDULED)
  })
})