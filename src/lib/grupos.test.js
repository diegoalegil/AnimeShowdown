import { describe, expect, it } from 'vitest'
import { DISPOSICIONES, DISPOSICIONES_ALBUM, disposicion, trocear } from './grupos.js'

describe('trocear', () => {
  it('parte la lista en grupos del tamaño pedido; el último puede ser menor', () => {
    expect(trocear([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    expect(trocear([], 4)).toEqual([])
    expect(trocear([1, 2], 0)).toEqual([[1], [2]])
  })
})

describe('disposicion', () => {
  it('dos columnas sin ninguna media query y la más ancha que coincida', () => {
    expect(disposicion(() => false)).toEqual({ columnas: 2, filas: 3 })
    expect(disposicion((q) => q === '(min-width: 48rem)').columnas).toBe(3)
    expect(disposicion(() => true).columnas).toBe(5)
  })

  it('cada grupo tiene entre seis y doce cartas', () => {
    for (const d of [...DISPOSICIONES, disposicion()]) {
      expect(d.columnas * d.filas).toBeGreaterThanOrEqual(6)
      expect(d.columnas * d.filas).toBeLessThanOrEqual(12)
    }
  })
})

describe('disposicion del álbum', () => {
  const album = (coincide) => disposicion(coincide, DISPOSICIONES_ALBUM, { columnas: 3, filas: 3 })

  it('las columnas de .bolsillos: 3, 5 desde 48rem y 6 desde 68.75rem', () => {
    expect(album(() => false).columnas).toBe(3)
    expect(album((q) => q === '(min-width: 48rem)').columnas).toBe(5)
    expect(album(() => true).columnas).toBe(6)
  })

  it('grupos de dos o tres filas, de nueve a doce huecos', () => {
    for (const d of [...DISPOSICIONES_ALBUM, album(() => false)]) {
      expect(d.filas).toBeGreaterThanOrEqual(2)
      expect(d.filas).toBeLessThanOrEqual(3)
      expect(d.columnas * d.filas).toBeGreaterThanOrEqual(9)
      expect(d.columnas * d.filas).toBeLessThanOrEqual(12)
    }
  })
})
