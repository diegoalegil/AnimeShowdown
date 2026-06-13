import { describe, expect, it } from 'vitest'
import {
  buildDossierEntries,
  buildGlobalRankMap,
  computeRecentVoteSlug,
} from './dossier-data'

const CATALOGO = new Map([
  ['luffy', { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece', imagenColorDominante: '#abc' }],
  ['zoro', { slug: 'zoro', nombre: 'Zoro', anime: 'One Piece' }],
])

describe('buildDossierEntries', () => {
  it('aplica ranking 1224: los empates comparten puesto y el siguiente se omite', () => {
    const entries = buildDossierEntries(
      [
        { slug: 'a', nombre: 'A', anime: 'X', count: 9 },
        { slug: 'b', nombre: 'B', anime: 'X', count: 7 },
        { slug: 'c', nombre: 'C', anime: 'X', count: 7 },
        { slug: 'd', nombre: 'D', anime: 'X', count: 1 },
      ],
      new Map(),
    )
    expect(entries.map((e) => e.yourRank)).toEqual([1, 2, 2, 4])
  })

  it('resuelve nombre/anime/color del catálogo y la posición global del mapa', () => {
    const entries = buildDossierEntries(
      [{ slug: 'luffy', count: 3 }],
      CATALOGO,
      new Map([['luffy', 12]]),
    )
    expect(entries[0]).toMatchObject({
      slug: 'luffy',
      name: 'Luffy',
      anime: 'One Piece',
      yourRank: 1,
      globalRank: 12,
      colorDominante: '#abc',
    })
  })

  it('sin dato global deja null (la placa enseña “—”)', () => {
    const entries = buildDossierEntries([{ slug: 'zoro', count: 1 }], CATALOGO)
    expect(entries[0].globalRank).toBeNull()
  })

  it('anime vacío del voto ("" de normalizeVote) cae al catálogo', () => {
    const entries = buildDossierEntries(
      [{ slug: 'zoro', nombre: '', anime: '', count: 2 }],
      CATALOGO,
    )
    expect(entries[0].name).toBe('Zoro')
    expect(entries[0].anime).toBe('One Piece')
  })
})

describe('computeRecentVoteSlug', () => {
  const NOW = Date.parse('2026-06-13T00:30:00Z')
  it('devuelve el ganador del último voto si está dentro de la ventana (at = ISO string real)', () => {
    expect(
      computeRecentVoteSlug(
        [
          { ganadorSlug: 'zoro', at: '2026-06-13T00:20:00Z' },
          { ganadorSlug: 'luffy', at: '2026-06-13T00:29:30Z' },
        ],
        NOW,
      ),
    ).toBe('luffy')
  })

  it('tolera epoch ms numérico', () => {
    expect(
      computeRecentVoteSlug([{ ganadorSlug: 'nami', at: NOW - 30 * 1000 }], NOW),
    ).toBe('nami')
  })

  it('fuera de ventana, sin votos o at corrupto: null', () => {
    expect(
      computeRecentVoteSlug([{ ganadorSlug: 'x', at: '2026-06-13T00:20:00Z' }], NOW),
    ).toBeNull()
    expect(computeRecentVoteSlug([{ ganadorSlug: 'x', at: 'no-fecha' }], NOW)).toBeNull()
    expect(computeRecentVoteSlug([], NOW)).toBeNull()
    expect(computeRecentVoteSlug(undefined as never, NOW)).toBeNull()
  })
})

describe('buildGlobalRankMap', () => {
  it('usa posicion del backend y cae al índice 1-based si falta', () => {
    const map = buildGlobalRankMap([
      { personaje: { slug: 'a' }, posicion: 5 },
      { personaje: { slug: 'b' } },
    ])
    expect(map.get('a')).toBe(5)
    expect(map.get('b')).toBe(2)
  })

  it('query sin resolver: mapa vacío', () => {
    expect(buildGlobalRankMap(undefined).size).toBe(0)
  })
})
