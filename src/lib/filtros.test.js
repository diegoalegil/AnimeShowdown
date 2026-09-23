import { describe, expect, it } from 'vitest'
import { crearCatalogo } from './catalog.js'
import { agruparPorSerie, busquedaDe, ESPECIALES, etiquetaFiltros, filtrarCartas, hayFiltros, leerFiltros, recorrido } from './filtros.js'

const cat = crearCatalogo({
  personajes: [
    { id: 'frieren', n: 1, nombre: 'Frieren', anime: 'Frieren', animeId: 'frieren' },
    { id: 'fern', n: 2, nombre: 'Fern', anime: 'Frieren', animeId: 'frieren' },
    { id: 'denji', n: 3, nombre: 'Denji', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'makima', n: 4, nombre: 'Makima', anime: 'Chainsaw Man', animeId: 'csm' },
  ],
  especiales: [
    { id: 'e-denji', n: 1, personajeId: 'denji', nombre: 'Denji', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'e-frieren', n: 2, personajeId: 'frieren', nombre: 'Frieren', anime: 'Frieren', animeId: 'frieren' },
  ],
  animes: [
    { id: 'frieren', titulo: 'Frieren' },
    { id: 'csm', titulo: 'Chainsaw Man' },
  ],
})

const ids = (lista) => lista.map((c) => c.id)
const params = (texto) => new URLSearchParams(texto)

describe('leerFiltros y busquedaDe', () => {
  it('leen y escriben la búsqueda y la serie de la URL', () => {
    expect(leerFiltros(params('q=fern&serie=frieren'), cat)).toEqual({ q: 'fern', serie: 'frieren' })
    expect(leerFiltros(params(`serie=${ESPECIALES}`), cat)).toEqual({ q: '', serie: ESPECIALES })
    expect(busquedaDe({ q: 'makima ', serie: 'csm' })).toBe('?serie=csm&q=makima+')
    expect(busquedaDe({ q: '', serie: '' })).toBe('')
  })

  it('ignoran series desconocidas y recortan búsquedas enormes', () => {
    expect(leerFiltros(params('serie=nada'), cat).serie).toBe('')
    expect(leerFiltros(params(`q=${'a'.repeat(500)}`), cat).q).toHaveLength(80)
  })

  it('distinguen si hay algún filtro activo', () => {
    expect(hayFiltros({ q: '  ', serie: '' })).toBe(false)
    expect(hayFiltros({ q: 'rem', serie: '' })).toBe(true)
    expect(hayFiltros({ q: '', serie: 'csm' })).toBe(true)
  })
})

describe('filtrarCartas', () => {
  it('sin filtros da los personajes; con «especiales», las especiales', () => {
    expect(ids(filtrarCartas({ q: '', serie: '' }, cat))).toEqual(['frieren', 'fern', 'denji', 'makima'])
    expect(ids(filtrarCartas({ q: '', serie: ESPECIALES }, cat))).toEqual(['e-denji', 'e-frieren'])
  })

  it('combina serie y texto, sin tildes', () => {
    expect(ids(filtrarCartas({ q: 'MÁKIMA', serie: '' }, cat))).toEqual(['makima'])
    expect(ids(filtrarCartas({ q: 'fern', serie: 'frieren' }, cat))).toEqual(['fern'])
    expect(ids(filtrarCartas({ q: 'fern', serie: 'csm' }, cat))).toEqual([])
    expect(ids(filtrarCartas({ q: 'frieren', serie: ESPECIALES }, cat))).toEqual(['e-frieren'])
  })

  it('devuelve la misma lista para los mismos filtros', () => {
    const filtros = { q: 'a', serie: '' }
    expect(filtrarCartas(filtros, cat)).toBe(filtrarCartas({ ...filtros }, cat))
  })
})

describe('recorrido', () => {
  it('da la posición y las vecinas sin dar la vuelta', () => {
    const r = recorrido({ q: '', serie: '' }, cat.carta('frieren'), cat)
    expect(r).toMatchObject({ indice: 0, total: 4, anterior: undefined, filtrada: false })
    expect(r.siguiente.id).toBe('fern')
    expect(recorrido({ q: '', serie: '' }, cat.carta('makima'), cat).siguiente).toBeUndefined()
  })

  it('sigue el orden filtrado', () => {
    const r = recorrido({ q: '', serie: 'csm' }, cat.carta('makima'), cat)
    expect(r).toMatchObject({ indice: 1, total: 2, filtrada: true })
    expect(r.anterior.id).toBe('denji')
  })

  it('sitúa una especial en el lugar de su personaje', () => {
    const r = recorrido({ q: '', serie: '' }, cat.carta('e-denji'), cat)
    expect(r.indice).toBe(2)
    expect(r.anterior.id).toBe('fern')
    expect(recorrido({ q: '', serie: ESPECIALES }, cat.carta('e-frieren'), cat).anterior.id).toBe('e-denji')
  })

  it('vuelve al catálogo completo si los filtros no incluyen la carta', () => {
    const r = recorrido({ q: 'zzz', serie: '' }, cat.carta('fern'), cat)
    expect(r).toMatchObject({ indice: 1, total: 4, filtrada: false })
    const e = recorrido({ q: 'zzz', serie: '' }, cat.carta('e-frieren'), cat)
    expect(e).toMatchObject({ indice: 1, total: 2 })
  })
})

describe('etiquetaFiltros', () => {
  it('nombra la serie y la búsqueda', () => {
    expect(etiquetaFiltros({ q: '', serie: 'csm' }, cat)).toBe('Chainsaw Man')
    expect(etiquetaFiltros({ q: ' rem ', serie: ESPECIALES }, cat)).toBe('Especiales · «rem»')
    expect(etiquetaFiltros({ q: '', serie: '' }, cat)).toBe('')
  })
})

describe('agruparPorSerie', () => {
  it('reúne las cartas consecutivas de cada serie con su número de orden', () => {
    const grupos = agruparPorSerie(cat.personajes.slice(1), cat)
    expect(grupos.map((g) => [g.anime.titulo, g.orden, ids(g.cartas)])).toEqual([
      ['Frieren', 1, ['fern']],
      ['Chainsaw Man', 2, ['denji', 'makima']],
    ])
    expect(agruparPorSerie([], cat)).toEqual([])
  })
})
