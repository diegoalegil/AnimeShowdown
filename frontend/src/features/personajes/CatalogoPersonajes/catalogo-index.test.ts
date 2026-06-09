import { describe, expect, it, vi } from 'vitest'
import {
  crearCatalogoIndex,
  filtrarCatalogo,
  filtrarRankingElo,
} from './catalogo-index'

const catalogo = [
  { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
  { slug: 'naruto', nombre: 'Naruto Uzumaki', anime: 'Naruto' },
  { slug: 'sakura', nombre: 'Sakura Kinomoto', anime: 'Cardcaptor Sakura' },
]

describe('catalogo-index', () => {
  it('precalcula stats una sola vez y filtra sin recalcular helpers', () => {
    const getStats = vi.fn((slug: string) => ({
      elo: slug === 'luffy' ? 2200 : slug === 'naruto' ? 1900 : 1300,
      wins: 0,
      losses: 0,
    }))
    const getPopularity = vi.fn((slug: string) => (
      slug === 'naruto' ? 900 : slug === 'luffy' ? 800 : 100
    ))
    const getCategories = vi.fn((slug: string) => (
      slug === 'naruto' ? ['protagonista'] : ['aventura']
    ))

    const index = crearCatalogoIndex(catalogo, {
      getStats,
      getPopularity,
      getCategories,
    })

    expect(index.rankedElo.map((personaje) => personaje.slug)).toEqual([
      'luffy',
      'naruto',
      'sakura',
    ])
    expect(filtrarCatalogo(index, { sort: 'elo_desc' })).toBe(index.sortedBy.elo_desc)
    expect(filtrarCatalogo(index, { sort: 'popularidad' })).toBe(index.sortedBy.popularidad)
    expect(filtrarCatalogo(index, { sort: 'nombre_az' })).toBe(index.sortedBy.nombre_az)
    expect(filtrarCatalogo(index, { sort: 'popularidad' }).map((p) => p.slug))
      .toEqual(['naruto', 'luffy', 'sakura'])
    expect(
      filtrarCatalogo(index, {
        sort: 'popularidad',
        tagFilter: 'aventura',
      }).map((p) => p.slug),
    )
      .toEqual(['luffy', 'sakura'])
    expect(filtrarCatalogo(index, { normalizedSearch: 'cardcaptor' }).map((p) => p.slug))
      .toEqual(['sakura'])
    expect(filtrarCatalogo(index, { tagFilter: 'protagonista' }).map((p) => p.slug))
      .toEqual(['naruto'])
    expect(filtrarRankingElo(index.rankedElo, { animeFilter: 'One Piece' }).map((p) => p.slug))
      .toEqual(['luffy'])

    expect(getStats).toHaveBeenCalledTimes(catalogo.length)
    expect(getPopularity).toHaveBeenCalledTimes(catalogo.length)
    expect(getCategories).toHaveBeenCalledTimes(catalogo.length)
  })
})
