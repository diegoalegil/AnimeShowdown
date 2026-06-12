import { afterEach, describe, expect, it } from 'vitest'
import { GATE_KEY, PAD, TOUR_STEPS, getGate, ringClip, setGate } from './tour-core'

describe('tour-core — gate del combate guiado', () => {
  afterEach(() => localStorage.removeItem(GATE_KEY))

  it('sin gate devuelve null (candidato); done/skipped cierran para siempre', () => {
    expect(getGate()).toBeNull()
    setGate('done')
    expect(getGate()).toBe('done')
    setGate('skipped')
    expect(getGate()).toBe('skipped')
  })
})

describe('tour-core — ringClip (telón con hueco)', () => {
  it('sin rect el hueco colapsa pero el polígono sigue siendo válido', () => {
    const clip = ringClip(null)
    expect(clip.startsWith('polygon(')).toBe(true)
    // Mismo nº de vértices que con rect: la transition de clip-path interpola.
    expect(clip.split(',').length).toBe(10)
  })

  it('con rect produce el anillo con los 4 vértices del hueco', () => {
    const clip = ringClip({ x: 100, y: 50, w: 200, h: 80 })
    expect(clip.split(',').length).toBe(10)
    expect(clip).toContain('100px 50px')
    expect(clip).toContain('300px 50px')
    expect(clip).toContain('300px 130px')
    expect(clip).toContain('100px 130px')
  })

  it('redondea coordenadas fraccionarias (clip-path estable)', () => {
    const clip = ringClip({ x: 10.4, y: 9.6, w: 100.2, h: 50.5 })
    expect(clip).toContain('10px 10px')
    expect(clip).not.toMatch(/\d+\.\d+px/)
  })
})

describe('tour-core — pasos', () => {
  it('son 4 pasos con kanji, copy y target resolubles', () => {
    expect(TOUR_STEPS).toHaveLength(4)
    const ctx = { votedSlug: 'goku' }
    for (const paso of TOUR_STEPS) {
      expect(paso.kanji).toHaveLength(1)
      expect(paso.title.length).toBeGreaterThan(0)
      const target = typeof paso.target === 'function' ? paso.target(ctx) : paso.target
      expect(target.startsWith('[')).toBe(true)
    }
  })

  it('el slug votado viaja al selector del paso 2', () => {
    const paso2 = TOUR_STEPS[1]
    expect(typeof paso2.target).toBe('function')
    expect((paso2.target as (c: object) => string)({ votedSlug: 'luffy' })).toBe(
      '[data-tour="rank-row"][data-slug="luffy"]',
    )
    expect((paso2.route as () => string)()).toBe('/ranking?tab=elo')
  })

  it('PAD acolcha el hueco del spotlight', () => {
    expect(PAD).toBeGreaterThan(0)
  })
})
