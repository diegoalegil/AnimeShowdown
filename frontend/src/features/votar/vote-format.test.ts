import { describe, expect, it } from 'vitest'
import { formatPersonalVoteImpact, formatVoteScore } from './vote-format'

describe('formatVoteScore', () => {
  it('enteros sin decimales y fracciones con un decimal', () => {
    expect(formatVoteScore(3)).toBe('3')
    expect(formatVoteScore(3.5)).toBe('3.5')
    expect(formatVoteScore('7')).toBe('7')
  })

  it('valores no numericos caen a 0', () => {
    expect(formatVoteScore(undefined)).toBe('0')
    expect(formatVoteScore('abc')).toBe('0')
    expect(formatVoteScore(Infinity)).toBe('0')
  })
})

describe('formatPersonalVoteImpact', () => {
  it('singular y plural correctos', () => {
    expect(formatPersonalVoteImpact({ rank: 2, count: 1 }))
      .toBe('#2 en tu ranking personal · 1 voto tuyo')
    expect(formatPersonalVoteImpact({ rank: 5, count: 3 }))
      .toBe('#5 en tu ranking personal · 3 votos tuyos')
  })

  it('sin impacto devuelve cadena vacia', () => {
    expect(formatPersonalVoteImpact(null)).toBe('')
  })
})
