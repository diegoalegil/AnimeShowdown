import { describe, expect, it } from 'vitest'
import { catalogo, crearCatalogo, esEspecial, normalizar, numeroCarta } from './catalog.js'

const mini = crearCatalogo({
  personajes: [
    { id: 'frieren', n: 1, nombre: 'Frieren', anime: 'Frieren', animeId: 'frieren', nativo: 'フリーレン' },
    { id: 'fern', n: 2, nombre: 'Fern', anime: 'Frieren', animeId: 'frieren' },
    { id: 'jose', n: 3, nombre: 'José Ángel', anime: 'Otra Serie', animeId: 'otra' },
  ],
  especiales: [{ id: 'e-frieren', n: 1, nombre: 'Frieren', anime: 'Frieren', animeId: 'frieren', variante: 'Maga' }],
  animes: [
    { id: 'otra', titulo: 'Otra Serie' },
    { id: 'frieren', titulo: 'Frieren', nativo: '葬送のフリーレン' },
  ],
})

describe('normalizar', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(normalizar('  José Ángel!! ')).toBe('jose angel')
    expect(normalizar('Chi-Chi')).toBe('chi chi')
    expect(normalizar('Übel')).toBe('ubel')
    expect(normalizar(undefined)).toBe('')
  })
})

describe('crearCatalogo', () => {
  it('busca por cualquier palabra, sin tildes y en cualquier orden', () => {
    expect(mini.buscar('angel jose').map((c) => c.id)).toEqual(['jose'])
    expect(mini.buscar('FRIEREN').map((c) => c.id)).toEqual(['frieren', 'fern', 'e-frieren'])
    expect(mini.buscar('maga').map((c) => c.id)).toEqual(['e-frieren'])
    expect(mini.buscar('').length).toBe(4)
  })

  it('busca también por el nombre nativo del personaje y del anime', () => {
    expect(mini.buscar('フリーレン').map((c) => c.id)).toEqual(['frieren', 'fern', 'e-frieren'])
  })

  it('filtra por anime', () => {
    expect(mini.buscar('', { animeId: 'otra' }).map((c) => c.id)).toEqual(['jose'])
  })

  it('agrupa por anime y ordena los animes por título', () => {
    expect(mini.cartasDeAnime('frieren').map((c) => c.id)).toEqual(['frieren', 'fern', 'e-frieren'])
    expect(mini.cartasDeAnime('nada')).toEqual([])
    expect(mini.animes.map((a) => a.id)).toEqual(['frieren', 'otra'])
  })

  it('da las cartas vecinas de forma circular', () => {
    expect(mini.vecinas('frieren').anterior.id).toBe('e-frieren')
    expect(mini.vecinas('frieren').siguiente.id).toBe('fern')
    expect(mini.vecinas('nada').siguiente).toBeUndefined()
  })
})

describe('numeroCarta', () => {
  it('rellena con ceros y marca las especiales', () => {
    expect(numeroCarta({ id: 'frieren', n: 370 })).toBe('0370')
    expect(numeroCarta({ id: 'e-luffy', n: 6 })).toBe('E-06')
    expect(esEspecial({ id: 'e-luffy' })).toBe(true)
    expect(esEspecial({ id: 'luffy' })).toBe(false)
  })
})

describe('catálogo real', () => {
  it('carga todas las cartas con ids únicos', () => {
    expect(catalogo.personajes.length).toBeGreaterThan(1000)
    expect(catalogo.especiales.length).toBeGreaterThan(0)
    expect(catalogo.total).toBe(catalogo.personajes.length + catalogo.especiales.length)
    expect(catalogo.carta('frieren')?.nombre).toBe('Frieren')
    for (const e of catalogo.especiales) expect(catalogo.existe(e.personajeId)).toBe(true)
  })
})
