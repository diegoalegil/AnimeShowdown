import { describe, expect, it, vi } from 'vitest'

import { buildPersonajeDetailContext } from './personaje-detail-data'

const catalogo = [
  { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
  { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
  { slug: 'nami', nombre: 'Nami', anime: 'One Piece' },
  { slug: 'naruto', nombre: 'Naruto Uzumaki', anime: 'Naruto' },
  { slug: 'sasuke', nombre: 'Sasuke Uchiha', anime: 'Naruto' },
  { slug: 'goku', nombre: 'Son Goku', anime: 'Dragon Ball' },
  { slug: 'vegeta', nombre: 'Vegeta', anime: 'Dragon Ball' },
  { slug: 'gojo', nombre: 'Satoru Gojo', anime: 'Jujutsu Kaisen' },
]

const elos: Record<string, number> = {
  zoro: 1910,
  naruto: 1880,
  gojo: 1840,
  luffy: 1810,
  sasuke: 1770,
  vegeta: 1710,
  nami: 1660,
  goku: 1600,
}

function getStats(slug: string) {
  return { elo: elos[slug] ?? 1000 }
}

describe('buildPersonajeDetailContext', () => {
  it('prepara navegacion y rankings de la ficha en una sola lectura del catalogo', () => {
    const getStatsSpy = vi.fn(getStats)
    const context = buildPersonajeDetailContext({
      catalogo,
      personaje: catalogo[0],
      slug: 'luffy',
      idx: 0,
      getStats: getStatsSpy,
    })

    expect(context?.prev.slug).toBe('gojo')
    expect(context?.next.slug).toBe('zoro')
    expect(context?.rankGlobal).toBe(4)
    expect(context?.rankAnime).toBe(2)
    expect(context?.totalAnime).toBe(3)
    expect(context?.animePersonajes.map((p) => p.slug)).toEqual(['luffy', 'zoro', 'nami'])
    expect(getStatsSpy).toHaveBeenCalledTimes(catalogo.length)
  })

  it('mantiene relacionados en orden de catalogo y limita duelos a seis rivales unicos', () => {
    const context = buildPersonajeDetailContext({
      catalogo,
      personaje: catalogo[0],
      slug: 'luffy',
      idx: 0,
      getStats,
    })

    expect(context?.relacionados.map((p) => p.slug)).toEqual(['zoro', 'nami'])
    expect(context?.duelosPopulares.map((p) => p.slug)).toEqual([
      'zoro',
      'nami',
      'naruto',
      'gojo',
      'sasuke',
      'vegeta',
    ])
  })

  it('devuelve null cuando la ficha no tiene personaje valido', () => {
    expect(buildPersonajeDetailContext({ catalogo, personaje: null, slug: 'missing', idx: -1 })).toBeNull()
  })
})
