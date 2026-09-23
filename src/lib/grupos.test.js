import { describe, expect, it } from 'vitest'
import { DISPOSICIONES, disposicion, trocear } from './grupos.js'

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
