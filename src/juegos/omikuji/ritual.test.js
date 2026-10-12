import { describe, expect, it } from 'vitest'
import {
  AMPLITUD_MAX,
  AMPLITUD_MIN,
  ASENTAMIENTO_S,
  amplitudTras,
  anguloAgitando,
  anguloAsentando,
  faseEn,
  fuerzaDe,
  posturaDe,
} from './ritual.js'

describe('ritual', () => {
  it('la amplitud empieza en el mínimo, crece y se queda en el máximo', () => {
    expect(amplitudTras(0)).toBe(AMPLITUD_MIN)
    expect(amplitudTras(0.5)).toBeGreaterThan(AMPLITUD_MIN)
    expect(amplitudTras(0.5)).toBeLessThan(AMPLITUD_MAX)
    expect(amplitudTras(5)).toBe(AMPLITUD_MAX)
    expect(amplitudTras(-1)).toBe(AMPLITUD_MIN)
  })

  it('la fuerza va de 0 a 1 según la amplitud', () => {
    expect(fuerzaDe(AMPLITUD_MIN)).toBe(0)
    expect(fuerzaDe(AMPLITUD_MAX)).toBe(1)
    expect(fuerzaDe((AMPLITUD_MIN + AMPLITUD_MAX) / 2)).toBeCloseTo(0.5)
    expect(fuerzaDe(99)).toBe(1)
  })

  it('el ángulo agitando nunca supera la amplitud máxima con margen de bamboleo', () => {
    let pico = 0
    for (let t = 0; t < 6; t += 0.005) pico = Math.max(pico, Math.abs(anguloAgitando(t)))
    expect(pico).toBeLessThanOrEqual(AMPLITUD_MAX * 1.08 + 1e-9)
    expect(pico).toBeGreaterThan(AMPLITUD_MAX * 0.9)
  })

  it('el asentamiento arranca donde se soltó y acaba casi quieto', () => {
    const t0 = 1.234
    const a0 = amplitudTras(t0)
    const fase = faseEn(t0)
    expect(anguloAsentando(0, a0, fase)).toBeCloseTo(a0 * Math.sin(fase), 6)
    expect(Math.abs(anguloAsentando(ASENTAMIENTO_S, a0, fase))).toBeLessThan(a0 * 0.08)
  })

  it('la postura acopla inclinación y desplazamiento al giro', () => {
    expect(posturaDe(0)).toEqual({ rz: 0, rx: 0, tx: 0 })
    const p = posturaDe(4)
    expect(p.rz).toBe(4)
    expect(p.rx).toBeCloseTo(1.4)
    expect(p.tx).toBeCloseTo(3.6)
  })
})
