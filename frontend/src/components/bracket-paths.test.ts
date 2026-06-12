import { describe, expect, it } from 'vitest'

import { elbowPath, half } from './bracket-paths'

describe('half', () => {
  it('redondea a la rejilla de 0.5px (hairlines nítidos)', () => {
    expect(half(10.3)).toBe(10.5)
    expect(half(10.74)).toBe(10.5)
    expect(half(10.76)).toBe(11)
  })
})

describe('elbowPath', () => {
  it('con destino casi al mismo alto degenera en línea recta', () => {
    expect(elbowPath(0, 100, 80, 101)).toBe('M 0 100 L 80 101')
  })

  it('el codo cae en la mitad del gap y respeta el sentido vertical', () => {
    const d = elbowPath(0, 0, 100, 60, 10)
    // Vértice en midX = 50; primer tramo horizontal hasta midX - r.
    expect(d).toContain('H 40')
    expect(d).toContain('Q 50 0 50 10')
    // Baja (dir = +1) y remata horizontal hasta el destino.
    expect(d).toContain('V 50')
    expect(d).toContain('H 100')
  })

  it('el radio se acota con gaps estrechos y saltos cortos', () => {
    // |Δy| = 8 → r ≤ 4; gap 12 → r ≤ 5. Gana el Δy/2 = 4.
    const d = elbowPath(0, 0, 12, 8, 10)
    expect(d).toContain('H 2') // midX 6 − r 4
    expect(d).toContain('Q 6 0 6 4')
  })

  it('subir y bajar son simétricos', () => {
    const baja = elbowPath(0, 0, 100, 40, 10)
    const sube = elbowPath(0, 40, 100, 0, 10)
    expect(baja).toContain('V 30')
    expect(sube).toContain('V 10')
  })
})
