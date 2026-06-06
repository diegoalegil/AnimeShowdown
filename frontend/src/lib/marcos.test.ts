import { describe, expect, it } from 'vitest'
import { MARCO_CLASS, marcoClass } from './marcos'

describe('marcos', () => {
  it('mapea cada id de marco a su clase de aro', () => {
    expect(marcoClass('bronce')).toBe('marco-bronce')
    expect(marcoClass('oro')).toBe('marco-oro')
    expect(marcoClass('prismatico')).toBe('marco-prismatico')
  })

  it('devuelve null para id ausente o desconocido', () => {
    expect(marcoClass(null)).toBeNull()
    expect(marcoClass(undefined)).toBeNull()
    expect(marcoClass('')).toBeNull()
    expect(marcoClass('no-existe')).toBeNull()
  })

  it('toda clase del mapa empieza por marco-', () => {
    for (const cls of Object.values(MARCO_CLASS)) {
      expect(cls.startsWith('marco-')).toBe(true)
    }
  })
})
