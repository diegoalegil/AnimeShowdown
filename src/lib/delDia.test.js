import { describe, expect, it } from 'vitest'
import { cartaDelDia } from './delDia.js'

const cartas = Array.from({ length: 1138 }, (_, i) => ({ id: `c${i}` }))

describe('cartaDelDia', () => {
  it('es la misma durante todo el día y cambia de un día a otro', () => {
    expect(cartaDelDia('2026-09-23', cartas)).toBe(cartaDelDia('2026-09-23', cartas))
    const semana = ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29']
    expect(new Set(semana.map((d) => cartaDelDia(d, cartas).id)).size).toBeGreaterThan(5)
  })

  it('sin cartas no hay carta del día', () => {
    expect(cartaDelDia('2026-09-23', [])).toBeUndefined()
  })
})
