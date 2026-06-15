import { describe, expect, it } from 'vitest'
import {
  blowsForReveal,
  heatFor,
  intensityForStrike,
  sparkVectors,
  MIN_BLOWS,
  MAX_BLOWS,
  DEFAULT_BLOWS,
  TIMING,
} from './forge-core'

const especial = { climax: 'ESPECIAL', carta: { rareza: 'ESPECIAL', especialCurada: true } }
const top = { climax: 'TOP', carta: { rareza: 'SSR' } }
const normal = { climax: 'NORMAL', carta: { rareza: 'SSR' } }

describe('blowsForReveal — vocabulario real del repo -> nº de golpes', () => {
  it('sobre con ESPECIAL (climax) -> 5 golpes (máxima tensión)', () => {
    expect(blowsForReveal([normal, normal, especial])).toBe(MAX_BLOWS)
    expect(MAX_BLOWS).toBe(5)
  })

  it('reveal.especial flag -> 5 aunque no haya item ESPECIAL', () => {
    expect(blowsForReveal([normal, normal], { especial: true })).toBe(5)
  })

  it('carta.rareza ESPECIAL / especialCurada -> 5', () => {
    expect(blowsForReveal([normal, { climax: 'NORMAL', carta: { rareza: 'ESPECIAL' } }])).toBe(5)
    expect(blowsForReveal([{ climax: 'NORMAL', carta: { especialCurada: true } }])).toBe(5)
  })

  it('sobre con clímax TOP (sin especial) -> 4', () => {
    expect(blowsForReveal([normal, normal, top])).toBe(4)
  })

  it('sobre estándar (>=2 cartas solo NORMAL) -> 3 (default)', () => {
    expect(blowsForReveal([normal, normal, normal, normal])).toBe(DEFAULT_BLOWS)
    expect(DEFAULT_BLOWS).toBe(3)
  })

  it('sobre de una sola carta sin clímax -> 2', () => {
    expect(blowsForReveal([normal])).toBe(MIN_BLOWS)
    expect(MIN_BLOWS).toBe(2)
  })

  it('vacío / desconocido -> 3 (default seguro)', () => {
    expect(blowsForReveal([])).toBe(3)
    expect(blowsForReveal(undefined)).toBe(3)
  })

  it('siempre dentro de [2, 5]', () => {
    for (const cartas of [[], [normal], [normal, normal], [top], [especial]]) {
      const b = blowsForReveal(cartas)
      expect(b).toBeGreaterThanOrEqual(MIN_BLOWS)
      expect(b).toBeLessThanOrEqual(MAX_BLOWS)
    }
  })
})

describe('heatFor — escalada de brasas', () => {
  it('reposo = low', () => {
    expect(heatFor(0, 5)).toBe('low')
    expect(heatFor(1, 5)).toBe('low')
  })
  it('desde heatFromStrike = high', () => {
    expect(heatFor(TIMING.heatFromStrike, 5)).toBe('high')
  })
  it('penúltimo golpe en adelante = max', () => {
    expect(heatFor(4, 5)).toBe('max') // golpe penúltimo de 5
    expect(heatFor(5, 5)).toBe('max')
  })
})

describe('intensityForStrike — escala el tambor de playYunque', () => {
  it('golpes tempranos = baja intensidad (sub casi mudo)', () => {
    expect(intensityForStrike(1)).toBe(0.3)
    expect(intensityForStrike(2)).toBe(0.3)
  })
  it('desde el 3er golpe sube y entra el tambor grave (>= 0.6)', () => {
    expect(intensityForStrike(3)).toBeGreaterThanOrEqual(0.6)
    expect(intensityForStrike(5)).toBeGreaterThan(intensityForStrike(3))
  })
  it('nunca supera 1', () => {
    expect(intensityForStrike(99)).toBeLessThanOrEqual(1)
  })
})

describe('sparkVectors — pool determinista de 8', () => {
  it('devuelve exactamente 8 vectores', () => {
    expect(sparkVectors()).toHaveLength(8)
  })
  it('es determinista (sin Math.random): dos llamadas son idénticas', () => {
    expect(sparkVectors()).toEqual(sparkVectors())
  })
  it('las chispas suben (algún y negativo) y abren en abanico', () => {
    const v = sparkVectors()
    expect(v.some((s) => s.y < 0)).toBe(true)
    expect(v.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true)
  })
})
