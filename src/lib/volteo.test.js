import { describe, expect, it } from 'vitest'
import { caraVisible, volteoHacia, volteoInicial, volteoQuieto } from './volteo.js'

const naruto = [{ id: 'naruto' }, { id: 'e-naruto__a' }, { id: 'e-naruto__b' }]
const frieren = [{ id: 'frieren' }, { id: 'e-frieren' }]
const fern = [{ id: 'fern' }]

describe('volteo', () => {
  it('empieza con la carta a la vista y otra versión detrás', () => {
    expect(volteoInicial('naruto', naruto)).toEqual({
      id: 'naruto',
      base: 'naruto',
      giro: 0,
      girando: false,
      caras: ['naruto', 'e-naruto__a'],
    })
    expect(volteoInicial('fern', fern).caras).toEqual(['fern', 'fern'])
  })

  it('da media vuelta al cambiar de versión, poniendo la nueva en la cara oculta', () => {
    const a = volteoInicial('naruto', naruto)
    const b = volteoHacia(a, 'e-naruto__b', naruto)
    expect(b).toMatchObject({ giro: 1, girando: true, caras: ['naruto', 'e-naruto__b'] })
    expect(volteoQuieto(b)).toMatchObject({ giro: 1, girando: false })
    expect(b.caras[caraVisible(b)]).toBe('e-naruto__b')
    const c = volteoHacia(b, 'naruto', naruto)
    expect(c).toMatchObject({ giro: 2, caras: ['naruto', 'e-naruto__b'] })
    expect(c.caras[caraVisible(c)]).toBe('naruto')
  })

  it('no gira al pasar a otro personaje', () => {
    const a = volteoHacia(volteoInicial('naruto', naruto), 'e-naruto__a', naruto)
    const b = volteoHacia(a, 'e-frieren', frieren)
    expect(b.giro).toBe(a.giro)
    expect(b.girando).toBe(false)
    expect(b.caras[caraVisible(b)]).toBe('e-frieren')
    expect(b.caras[1 - caraVisible(b)]).toBe('frieren')
  })

  it('devuelve el mismo estado si la carta no cambia', () => {
    const a = volteoInicial('frieren', frieren)
    expect(volteoHacia(a, 'frieren', frieren)).toBe(a)
    expect(volteoQuieto(a)).toBe(a)
  })
})
