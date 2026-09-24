import { describe, expect, it } from 'vitest'
import { catalogo } from './catalog.js'
import { cartasDestacadas, DESTACADAS } from './portada.js'

describe('portada', () => {
  it('todas las cartas destacadas existen y no se repiten', () => {
    expect(new Set(DESTACADAS).size).toBe(DESTACADAS.length)
    expect(cartasDestacadas().map((c) => c.id)).toEqual(DESTACADAS)
  })

  it('ignora las que falten en el catálogo', () => {
    const parcial = { carta: (id) => (id === DESTACADAS[1] ? catalogo.carta(id) : undefined) }
    expect(cartasDestacadas(parcial).map((c) => c.id)).toEqual([DESTACADAS[1]])
  })
})
