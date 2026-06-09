import { describe, expect, it } from 'vitest'

import {
  buscarAnimes,
  filtrarOrdenarAnimes,
  ordenarAnimesCatalogo,
} from './animes'

type AnimeResumen = { anime: string }

const catalogo = [
  { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
  { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
  { slug: 'naruto', nombre: 'Naruto Uzumaki', anime: 'Naruto' },
  { slug: 'goku', nombre: 'Son Goku', anime: 'Dragon Ball' },
  { slug: 'tanjiro', nombre: 'Tanjiro Kamado', anime: 'Demon Slayer' },
]

describe('animes catalog helpers', () => {
  it('encuentra universos por nombre de personaje', () => {
    expect(
      buscarAnimes('zoro', catalogo).map((anime: AnimeResumen) => anime.anime),
    ).toEqual(['One Piece'])
  })

  it('mantiene busqueda por alias popular', () => {
    expect(
      buscarAnimes('kimetsu', catalogo).map((anime: AnimeResumen) => anime.anime),
    ).toEqual(['Demon Slayer'])
  })

  it('ordena por total de personajes con desempate alfabetico', () => {
    const ordenados = ordenarAnimesCatalogo(buscarAnimes('', catalogo), 'personajes')

    expect(ordenados.map((anime: AnimeResumen) => anime.anime)).toEqual([
      'One Piece',
      'Demon Slayer',
      'Dragon Ball',
      'Naruto',
    ])
  })

  it('combina filtro y orden del catalogo', () => {
    const resultado = filtrarOrdenarAnimes({
      catalogo,
      query: 'u',
      sort: 'az',
    })

    expect(resultado.map((anime: AnimeResumen) => anime.anime)).toEqual([
      'Demon Slayer',
      'Dragon Ball',
      'Naruto',
      'One Piece',
    ])
  })
})
