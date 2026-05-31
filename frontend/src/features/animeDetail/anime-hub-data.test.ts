import { describe, expect, it } from 'vitest'
import {
  buildAnimeTierList,
  buildCrossAnimeRecommendations,
  filterAnimeMovers,
  getClosestEloDuel,
  getHallOfFame,
  getMonthlyHero,
  getRevelation,
} from './anime-hub-data'

const luffy = { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece', elo: 2100 }
const zoro = { slug: 'zoro', nombre: 'Zoro', anime: 'One Piece', elo: 2050 }
const nami = { slug: 'nami', nombre: 'Nami', anime: 'One Piece', elo: 1800 }
const goku = { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball', elo: 2200 }
const naruto = { slug: 'naruto', nombre: 'Naruto', anime: 'Naruto', elo: 2150 }

describe('anime-hub-data', () => {
  it('builds an automatic ELO tier list in descending order', () => {
    const tiers = buildAnimeTierList([nami, luffy, zoro])

    expect(tiers[0].id).toBe('S')
    expect(tiers[0].personajes.map((p) => p.slug)).toEqual(['luffy'])
    expect(tiers.flatMap((tier) => tier.personajes.map((p) => p.slug))).toEqual([
      'luffy',
      'zoro',
      'nami',
    ])
  })

  it('filters movers by anime and prioritizes new or rising characters', () => {
    const movers = filterAnimeMovers([
      { slug: 'zoro', nombre: 'Zoro', anime: 'One Piece', delta: -3, esNuevo: false },
      { slug: 'nami', nombre: 'Nami', anime: 'One Piece', delta: 2, esNuevo: false },
      { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece', delta: null, esNuevo: true },
      { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball', delta: 9, esNuevo: false },
    ], 'One Piece')

    expect(movers.map((item) => item.slug)).toEqual(['luffy', 'nami', 'zoro'])
    expect(getRevelation(movers)?.slug).toBe('luffy')
  })

  it('picks the monthly hero from a global monthly ranking', () => {
    const hero = getMonthlyHero([
      { personaje: goku, votos: 12 },
      { personaje: zoro, votos: 7 },
    ], 'One Piece')

    expect(hero?.personaje.slug).toBe('zoro')
    expect(hero?.votos).toBe(7)
  })

  it('builds hall of fame entries only for finished tournaments won by the anime', () => {
    const hall = getHallOfFame([
      { slug: 'cup-one', nombre: 'Cup One', estado: 'FINISHED', ganadorSlug: 'luffy', fechaFinalizacion: '2026-05-10T00:00:00Z' },
      { slug: 'cup-two', nombre: 'Cup Two', estado: 'FINISHED', ganadorSlug: 'goku', fechaFinalizacion: '2026-05-11T00:00:00Z' },
      { slug: 'cup-live', nombre: 'Cup Live', estado: 'IN_PROGRESS', ganadorSlug: 'zoro' },
    ], new Map([
      ['luffy', luffy],
      ['zoro', zoro],
      ['goku', goku],
    ]), 'One Piece')

    expect(hall).toHaveLength(1)
    expect(hall[0].torneo.slug).toBe('cup-one')
    expect(hall[0].ganador.slug).toBe('luffy')
  })

  it('keeps recommendations cross-anime and sorted by score', () => {
    const recs = buildCrossAnimeRecommendations([
      { ...zoro, score: 0.95 },
      { ...naruto, score: 0.88 },
      { ...goku, score: 0.93 },
    ], 'One Piece')

    expect(recs.map((item) => item.slug)).toEqual(['goku', 'naruto'])
  })

  it('finds the closest ELO duel inside the anime', () => {
    const duel = getClosestEloDuel([luffy, zoro, nami])

    expect(duel?.a.slug).toBe('luffy')
    expect(duel?.b.slug).toBe('zoro')
    expect(duel?.diff).toBe(50)
  })
})
