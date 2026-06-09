import { describe, expect, it } from 'vitest'

import { buildGamesHubPlan, shouldShowDailyHistory } from './games-hub-plan'

const games = [
  {
    to: '/games/shadow-guess',
    titulo: 'Shadow Guess',
    storageKey: 'shadow',
    destacado: true,
  },
  {
    to: '/games/anime-reveal',
    titulo: 'Anime Reveal',
    storageKey: 'anime',
  },
  {
    to: '/games/oraculo',
    titulo: 'Oraculo',
    storageKey: 'oraculo',
    endless: true,
  },
  {
    to: '/games/elo-duel',
    titulo: 'ELO Duel',
    storageKey: 'elo',
    endless: true,
  },
]

describe('buildGamesHubPlan', () => {
  it('mantiene el destacado configurado cuando sigue pendiente', () => {
    const plan = buildGamesHubPlan(games, {})

    expect(plan.destacado?.to).toBe('/games/shadow-guess')
    expect(plan.otros.map((game) => game.to)).toEqual([
      '/games/anime-reveal',
      '/games/oraculo',
      '/games/elo-duel',
    ])
    expect(plan.pendingDailyCount).toBe(2)
    expect(plan.completedDailyCount).toBe(0)
  })

  it('recomienda el siguiente daily pendiente antes de modos endless', () => {
    const plan = buildGamesHubPlan(games, {
      '/games/shadow-guess': { completadoHoy: true },
    })

    expect(plan.destacado?.to).toBe('/games/anime-reveal')
    expect(plan.otros.map((game) => game.to)).toEqual([
      '/games/oraculo',
      '/games/elo-duel',
      '/games/shadow-guess',
    ])
    expect(plan.pendingDailyCount).toBe(1)
    expect(plan.completedDailyCount).toBe(1)
  })

  it('pasa a endless cuando todos los dailies estan completos', () => {
    const plan = buildGamesHubPlan(games, {
      '/games/shadow-guess': { completadoHoy: true },
      '/games/anime-reveal': { completadoHoy: true },
    })

    expect(plan.destacado?.to).toBe('/games/oraculo')
    expect(plan.otros.map((game) => game.to)).toEqual([
      '/games/elo-duel',
      '/games/shadow-guess',
      '/games/anime-reveal',
    ])
    expect(plan.pendingDailyCount).toBe(0)
    expect(plan.completedDailyCount).toBe(2)
  })
})

describe('shouldShowDailyHistory', () => {
  it('oculta el calendario en cuentas sin actividad', () => {
    expect(shouldShowDailyHistory({ current: 0, longest: 0 }, 0)).toBe(false)
  })

  it('muestra el calendario con racha actual, record o completados hoy', () => {
    expect(shouldShowDailyHistory({ current: 2, longest: 2 }, 0)).toBe(true)
    expect(shouldShowDailyHistory({ current: 0, longest: 5 }, 0)).toBe(true)
    expect(shouldShowDailyHistory({ current: 0, longest: 0 }, 1)).toBe(true)
  })
})
