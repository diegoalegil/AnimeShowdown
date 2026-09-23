import { describe, expect, it } from 'vitest'
import {
  busquedaAlbum,
  crearHojas,
  cuantasTengo,
  EMPEZADAS,
  etiquetaHoja,
  filasHoja,
  filtrarHojas,
  fraccion,
  idsPorHoja,
  leerFiltrosAlbum,
  porcentaje,
  progreso,
  recuento,
  textoRecuento,
} from './album.js'
import { crearCatalogo } from './catalog.js'
import { ESPECIALES } from './filtros.js'

const cat = crearCatalogo({
  personajes: [
    { id: 'frieren', n: 1, nombre: 'Frieren', anime: 'Frieren', animeId: 'frieren' },
    { id: 'fern', n: 2, nombre: 'Fern', anime: 'Frieren', animeId: 'frieren' },
    { id: 'denji', n: 3, nombre: 'Denji', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'makima', n: 4, nombre: 'Makima', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'power', n: 5, nombre: 'Power', anime: 'Chainsaw Man', animeId: 'csm' },
  ],
  especiales: [{ id: 'e-denji', n: 1, personajeId: 'denji', nombre: 'Denji', anime: 'Chainsaw Man', animeId: 'csm' }],
  animes: [
    { id: 'frieren', titulo: 'Frieren', nativo: '葬送のフリーレン' },
    { id: 'csm', titulo: 'Chainsaw Man', nativo: 'チェンソーマン' },
  ],
})

const hojas = crearHojas(cat)
const params = (texto) => new URLSearchParams(texto)

describe('crearHojas', () => {
  it('una hoja por serie en orden de catálogo y las especiales al final', () => {
    expect(hojas.map((h) => [h.id, h.orden, h.cartas.length, h.especiales])).toEqual([
      ['frieren', 1, 2, false],
      ['csm', 2, 3, false],
      [ESPECIALES, 3, 1, true],
    ])
    expect(hojas[1]).toMatchObject({ titulo: 'Chainsaw Man', nativo: 'チェンソーマン' })
  })

  it('las cartas de cada hoja conservan su orden', () => {
    expect(hojas[1].cartas.map((c) => c.n)).toEqual([3, 4, 5])
  })
})

describe('progreso', () => {
  const tengo = { fern: 2, denji: 1, makima: 1, power: 4, 'e-denji': 1 }

  it('cuenta personajes y especiales por separado y por hoja', () => {
    const p = progreso(hojas, tengo)
    expect(p.personajes).toEqual({ tengo: 4, total: 5 })
    expect(p.especiales).toEqual({ tengo: 1, total: 1 })
    expect([...p.porHoja]).toEqual([
      ['frieren', 1],
      ['csm', 3],
      [ESPECIALES, 1],
    ])
    expect(cuantasTengo(hojas[0].cartas, {})).toBe(0)
  })

  it('las repetidas no cuentan dos veces', () => {
    expect(progreso(hojas, { power: 9 }).personajes.tengo).toBe(1)
  })

  it('fracción y porcentaje nunca exageran', () => {
    expect(fraccion({ tengo: 1, total: 4 })).toBe(0.25)
    expect(fraccion({ tengo: 0, total: 0 })).toBe(0)
    expect(porcentaje({ tengo: 0, total: 1086 })).toBe(0)
    expect(porcentaje({ tengo: 1, total: 1086 })).toBe(1)
    expect(porcentaje({ tengo: 1085, total: 1086 })).toBe(99)
    expect(porcentaje({ tengo: 1086, total: 1086 })).toBe(100)
    expect(porcentaje({ tengo: 543, total: 1086 })).toBe(50)
  })
})

describe('filtros del álbum', () => {
  it('leen y escriben la serie y «solo empezadas» en la URL', () => {
    expect(leerFiltrosAlbum(params('serie=csm&ver=empezadas'), hojas)).toEqual({ serie: 'csm', empezadas: true })
    expect(leerFiltrosAlbum(params(`serie=${ESPECIALES}`), hojas)).toEqual({ serie: ESPECIALES, empezadas: false })
    expect(leerFiltrosAlbum(params('serie=nada&ver=otra'), hojas)).toEqual({ serie: '', empezadas: false })
    expect(busquedaAlbum({ serie: 'csm', empezadas: true })).toBe(`?serie=csm&ver=${EMPEZADAS}`)
    expect(busquedaAlbum({})).toBe('')
  })

  it('una serie concreta, todas o solo las empezadas', () => {
    const { porHoja } = progreso(hojas, { denji: 1 })
    const ids = (lista) => lista.map((h) => h.id)
    expect(ids(filtrarHojas(hojas, { serie: 'frieren', empezadas: true }, porHoja))).toEqual(['frieren'])
    expect(ids(filtrarHojas(hojas, { serie: '', empezadas: false }, porHoja))).toEqual(['frieren', 'csm', ESPECIALES])
    expect(ids(filtrarHojas(hojas, { serie: '', empezadas: true }, porHoja))).toEqual(['csm'])
  })

  it('reparte cartas por hoja como texto, las especiales aparte', () => {
    expect([...idsPorHoja(['makima', 'fern', 'e-denji', 'denji', 'zzz'], cat)]).toEqual([
      ['csm', 'makima denji'],
      ['frieren', 'fern'],
      [ESPECIALES, 'e-denji'],
    ])
  })

  it('etiqueta cada serie con su progreso y calcula sus filas', () => {
    expect(etiquetaHoja(hojas[1], 3)).toBe('Chainsaw Man 3/3')
    expect(filasHoja(22)).toEqual({ 3: 8, 5: 5, 6: 4 })
    expect(filasHoja(1)).toEqual({ 3: 1, 5: 1, 6: 1 })
  })
})

describe('recuento', () => {
  it('cuenta personajes y especiales por separado, como el álbum', () => {
    const r = recuento({ frieren: 2, denji: 1, 'e-denji': 1, borrada: 3 }, cat)
    expect(r).toEqual({ personajes: { tengo: 2, total: 5 }, especiales: { tengo: 1, total: 1 } })
    expect(textoRecuento(r)).toBe('2 de 5 cartas · 1 de 1 especial')
    expect(textoRecuento(r, { total: false })).toBe('2 cartas y 1 especial')
    expect(textoRecuento(recuento({ fern: 1 }, cat), { total: false })).toBe('1 carta')
  })
})
