import { describe, expect, it } from 'vitest'
import { toFighter } from './versus-fighter'

describe('toFighter', () => {
  it('mapea personaje → fighter (slug/name/series + kanji del universo)', () => {
    const f = toFighter({ slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball' })
    expect(f).toMatchObject({ slug: 'goku', name: 'Goku', series: 'Dragon Ball' })
    expect(typeof f.kanji).toBe('string')
    expect(f.kanji.length).toBeGreaterThan(0)
  })

  it('cae al kanji genérico 界 para un anime sin identidad curada', () => {
    const f = toFighter({ slug: 'x', nombre: 'X', anime: 'Universo Inexistente 9999' })
    expect(f.kanji).toBe('界')
  })
})
