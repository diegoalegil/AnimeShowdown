import { describe, expect, it } from 'vitest'
import {
  barajar,
  crearAzar,
  elegirDeSeriesDistintas,
  elegirUno,
  elegirVarios,
  entero,
  enteroEntre,
  mezclarOpciones,
  semillaDe,
} from './azar.js'

const CARTAS = [
  { id: 'a1', animeId: 'a' },
  { id: 'a2', animeId: 'a' },
  { id: 'b1', animeId: 'b' },
  { id: 'c1', animeId: 'c' },
  { id: 'c2', animeId: 'c' },
  { id: 'd1', animeId: 'd' },
]

describe('crearAzar', () => {
  it('con semilla repite la misma secuencia; con otra, distinta', () => {
    const a = crearAzar('silueta:2026-03-01')
    const b = crearAzar('silueta:2026-03-01')
    const c = crearAzar('silueta:2026-03-02')
    const lista = (rng) => Array.from({ length: 5 }, rng)
    const primera = lista(a)
    expect(lista(b)).toEqual(primera)
    expect(lista(c)).not.toEqual(primera)
    for (const x of primera) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
    expect(crearAzar(7)()).toBe(crearAzar(7)())
  })

  it('sin semilla es Math.random y la semilla de texto es estable', () => {
    expect(crearAzar()).toBe(Math.random)
    expect(crearAzar(null)).toBe(Math.random)
    expect(semillaDe('abc')).toBe(semillaDe('abc'))
    expect(semillaDe('abc')).not.toBe(semillaDe('abd'))
  })
})

describe('enteros y elección', () => {
  it('nunca se salen del rango aunque el generador devuelva 1', () => {
    expect(entero(3, () => 1)).toBe(2)
    expect(entero(3, () => 0)).toBe(0)
    expect(enteroEntre(5, 7, () => 0.99)).toBe(7)
    expect(enteroEntre(5, 7, () => 0)).toBe(5)
    expect(elegirUno(['x', 'y'], () => 1)).toBe('y')
    expect(elegirUno([], () => 0)).toBeUndefined()
  })

  it('baraja una copia sin perder ni repetir elementos', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8]
    const rng = crearAzar(3)
    const mezcla = barajar(lista, rng)
    expect(mezcla).not.toBe(lista)
    expect([...mezcla].sort()).toEqual([...lista].sort())
    expect(lista).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    // Con semilla, la misma mezcla.
    expect(barajar(lista, crearAzar(3))).toEqual(mezcla)
  })

  it('elige n distintos, y todos si se piden más de los que hay', () => {
    const rng = crearAzar(11)
    const tres = elegirVarios(CARTAS, 3, rng)
    expect(tres).toHaveLength(3)
    expect(new Set(tres).size).toBe(3)
    expect(elegirVarios(CARTAS, 20, rng)).toHaveLength(CARTAS.length)
    expect(elegirVarios(CARTAS, 0, rng)).toEqual([])
  })

  it('reparte de forma uniforme a lo largo de muchas tiradas', () => {
    const rng = crearAzar(2026)
    const cuentas = new Map()
    for (let i = 0; i < 6000; i++) {
      const id = elegirUno(CARTAS, rng).id
      cuentas.set(id, (cuentas.get(id) ?? 0) + 1)
    }
    for (const n of cuentas.values()) {
      expect(n).toBeGreaterThan(800)
      expect(n).toBeLessThan(1200)
    }
  })
})

describe('elegirDeSeriesDistintas', () => {
  it('ninguna serie se repite y respeta las excluidas', () => {
    const rng = crearAzar(5)
    const tres = elegirDeSeriesDistintas(CARTAS, 3, rng)
    expect(tres).toHaveLength(3)
    expect(new Set(tres.map((c) => c.animeId)).size).toBe(3)
    const sinA = elegirDeSeriesDistintas(CARTAS, 3, rng, { excluir: new Set(['a']) })
    expect(sinA.some((c) => c.animeId === 'a')).toBe(false)
    // Hay cuatro series: no puede dar más de cuatro cartas.
    expect(elegirDeSeriesDistintas(CARTAS, 10, rng)).toHaveLength(4)
  })

  it('mezcla la opción correcta entre los distractores', () => {
    const opciones = mezclarOpciones('ok', ['no1', 'no2', 'no3'], crearAzar(1))
    expect(opciones).toHaveLength(4)
    expect(opciones).toContain('ok')
    expect([...opciones].sort()).toEqual(['no1', 'no2', 'no3', 'ok'])
  })
})
