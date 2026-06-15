import { describe, expect, it } from 'vitest'

import {
  KANJI_DEFECTO,
  agruparEnEstanterias,
  construirBiblioteca,
  contarResultados,
  derivarUniversos,
  lacaPorIndice,
  normalizar,
  ordenarUniversos,
  universoMatches,
} from './library-core'

// Catálogo con la MISMA forma que la salida de getAnimesCatalogo (animes.js):
// anime/slug/total/eloMedio/eloPromedio/topElo/destacadoScore/top3/aliases/searchText.
const onePiece = {
  anime: 'One Piece',
  slug: 'one-piece',
  total: 3,
  eloMedio: 1600,
  eloPromedio: 1600,
  topElo: { slug: 'luffy', nombre: 'Monkey D. Luffy', elo: 1700 },
  destacadoScore: 1724,
  top3: [
    { slug: 'luffy', nombre: 'Monkey D. Luffy' },
    { slug: 'zoro', nombre: 'Roronoa Zoro' },
    { slug: 'nami', nombre: 'Nami' },
  ],
  aliases: ['op', 'mugiwara'],
  searchText: 'one piece one-piece op mugiwara monkey d. luffy roronoa zoro nami',
}
const demonSlayer = {
  anime: 'Demon Slayer',
  slug: 'demon-slayer',
  total: 2,
  eloMedio: 1550,
  eloPromedio: 1550,
  topElo: { slug: 'tanjiro', nombre: 'Tanjiro Kamado', elo: 1620 },
  destacadoScore: 1636,
  top3: [
    { slug: 'tanjiro', nombre: 'Tanjiro Kamado' },
    { slug: 'nezuko', nombre: 'Nezuko Kamado' },
  ],
  aliases: ['kimetsu', 'kimetsu no yaiba'],
  searchText: 'demon slayer demon-slayer kimetsu kimetsu no yaiba tanjiro kamado nezuko kamado',
}
const evangelion = {
  anime: 'Évangelion',
  slug: 'evangelion',
  total: 1,
  eloMedio: 1500,
  eloPromedio: 1500,
  topElo: { slug: 'shinji', nombre: 'Shinji Ikari', elo: 1500 },
  destacadoScore: 1508,
  top3: [{ slug: 'shinji', nombre: 'Shinji Ikari' }],
  aliases: [],
  searchText: 'evangelion evangelion shinji ikari',
}

const catalogoAnimes = [onePiece, demonSlayer, evangelion]

describe('library-core · normalizar / matching', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalizar('Évangelion')).toBe('evangelion')
    expect(normalizar('  ATTACK  ')).toBe('attack')
  })

  it('universoMatches usa el searchText pre-normalizado (nombre, alias, personajes)', () => {
    const [op, ds] = derivarUniversos(catalogoAnimes)
    expect(universoMatches(op, '')).toBe(true) // query vacía → todos casan
    expect(universoMatches(op, 'mugiwara')).toBe(true) // alias
    expect(universoMatches(op, 'zoro')).toBe(true) // personaje
    expect(universoMatches(ds, 'kimetsu')).toBe(true) // alias popular
    expect(universoMatches(op, 'kimetsu')).toBe(false)
  })

  it('matchea por slug aunque el texto tenga acentos en la query', () => {
    const u = derivarUniversos([evangelion])[0]
    expect(universoMatches(u, 'évangelion')).toBe(true)
    expect(universoMatches(u, 'evangelion')).toBe(true)
  })

  it('universoMatches funciona sin searchText (universo construido a mano)', () => {
    const manual = {
      anime: 'Naruto',
      slug: 'naruto',
      numPersonajes: 1,
      eloMedio: 1500,
      topEloMax: 1500,
      destacadoScore: 8,
      top3: [{ slug: 'naruto', nombre: 'Naruto Uzumaki' }],
      aliases: ['ninja'],
      kanji: '忍',
    }
    expect(universoMatches(manual, 'ninja')).toBe(true)
    expect(universoMatches(manual, 'uzumaki')).toBe(true)
    expect(universoMatches(manual, 'goku')).toBe(false)
  })
})

describe('library-core · derivarUniversos', () => {
  it('reproyecta total→numPersonajes, eloMedio, top3 y marca eloSintetico', () => {
    const [op] = derivarUniversos(catalogoAnimes)
    expect(op.numPersonajes).toBe(3)
    expect(op.eloMedio).toBe(1600)
    expect(op.topEloMax).toBe(1700)
    expect(op.top3).toHaveLength(3)
    expect(op.top3[0]).toEqual({ slug: 'luffy', nombre: 'Monkey D. Luffy' })
    expect(op.eloSintetico).toBe(true)
  })

  it('resuelve el kanji curado y cae a 印 cuando falta', () => {
    const kanjiDe = (anime: string) =>
      anime === 'One Piece' ? '海' : undefined
    const [op, ds] = derivarUniversos(catalogoAnimes, kanjiDe)
    expect(op.kanji).toBe('海')
    expect(ds.kanji).toBe(KANJI_DEFECTO)
    expect(KANJI_DEFECTO).toBe('印')
  })

  it('soporta un anime VACÍO (sin personajes): eloMedio 0, top3 vacío', () => {
    const vacio = {
      anime: 'Anime Vacío',
      slug: 'anime-vacio',
      total: 0,
      eloMedio: 0,
      eloPromedio: 0,
      topElo: undefined,
      destacadoScore: 0,
      top3: [],
      aliases: [],
      searchText: 'anime vacio anime-vacio',
    }
    const [u] = derivarUniversos([vacio])
    expect(u.numPersonajes).toBe(0)
    expect(u.eloMedio).toBe(0)
    expect(u.topEloMax).toBe(0)
    expect(u.top3).toEqual([])
  })
})

describe('library-core · orden estable (mismos criterios que SORT_LABELS)', () => {
  const universos = derivarUniversos(catalogoAnimes)

  it('az: alfabético insensible a acentos', () => {
    expect(ordenarUniversos(universos, 'az').map((u) => u.anime)).toEqual([
      'Demon Slayer',
      'Évangelion',
      'One Piece',
    ])
  })

  it('personajes: por nº de personajes desc, desempate alfabético', () => {
    expect(ordenarUniversos(universos, 'personajes').map((u) => u.anime)).toEqual([
      'One Piece',
      'Demon Slayer',
      'Évangelion',
    ])
  })

  it('elo: por ELO máximo desc', () => {
    expect(ordenarUniversos(universos, 'elo').map((u) => u.anime)).toEqual([
      'One Piece',
      'Demon Slayer',
      'Évangelion',
    ])
  })

  it('promedio: por ELO medio desc', () => {
    expect(ordenarUniversos(universos, 'promedio').map((u) => u.anime)).toEqual([
      'One Piece',
      'Demon Slayer',
      'Évangelion',
    ])
  })

  it('destacados: por destacadoScore desc (orden por defecto)', () => {
    expect(ordenarUniversos(universos).map((u) => u.anime)).toEqual([
      'One Piece',
      'Demon Slayer',
      'Évangelion',
    ])
    // criterio desconocido → cae a destacados
    expect(ordenarUniversos(universos, 'inexistente').map((u) => u.anime)).toEqual([
      'One Piece',
      'Demon Slayer',
      'Évangelion',
    ])
  })

  it('no muta el array de entrada', () => {
    const copia = [...universos]
    ordenarUniversos(universos, 'az')
    expect(universos).toEqual(copia)
  })
})

describe('library-core · estanterías + pipeline', () => {
  it('agrupa en filas de N respetando el orden', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ slug: `s${i}` }))
    const filas = agruparEnEstanterias(items as never[], 4)
    expect(filas.map((f) => f.length)).toEqual([4, 4, 1])
    expect(filas[2][0]).toEqual({ slug: 's8' })
  })

  it('porEstanteria<1 se satura a 1', () => {
    expect(agruparEnEstanterias([{ slug: 'a' }, { slug: 'b' }] as never[], 0)).toHaveLength(2)
  })

  it('contarResultados devuelve el total con query vacía y los matches con query', () => {
    const universos = derivarUniversos(catalogoAnimes)
    expect(contarResultados(universos, '')).toBe(3)
    expect(contarResultados(universos, 'kimetsu')).toBe(1)
    expect(contarResultados(universos, 'xyz')).toBe(0)
  })

  it('construirBiblioteca ordena, agrupa, marca _match/_i y cuenta visibles', () => {
    const universos = derivarUniversos(catalogoAnimes)
    const { estanterias, total, visibles } = construirBiblioteca(universos, {
      criterio: 'az',
      query: 'kimetsu',
      porEstanteria: 2,
    })
    expect(total).toBe(3)
    expect(visibles).toBe(1)
    // 3 universos en filas de 2 → [2, 1]
    expect(estanterias.map((f) => f.length)).toEqual([2, 1])
    // _i es el índice global tras ordenar (az)
    const planos = estanterias.flat()
    expect(planos.map((u) => u._i)).toEqual([0, 1, 2])
    // solo Demon Slayer casa
    expect(planos.filter((u) => u._match).map((u) => u.anime)).toEqual(['Demon Slayer'])
  })

  it('construirBiblioteca con catálogo vacío no rompe', () => {
    const { estanterias, total, visibles } = construirBiblioteca([])
    expect(estanterias).toEqual([])
    expect(total).toBe(0)
    expect(visibles).toBe(0)
  })
})

describe('library-core · laca determinista', () => {
  it('reparte 3 acabados de forma estable por índice', () => {
    expect([0, 1, 2, 3].map(lacaPorIndice)).toEqual(['tinta', 'carmin', 'madera', 'tinta'])
    // determinista para índices negativos también (defensivo)
    expect(lacaPorIndice(-1)).toBe('madera')
  })
})
