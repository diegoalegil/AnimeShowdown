import { describe, expect, it } from 'vitest'
import {
  BREATH_AT_MS,
  BREATH_MS,
  FLASH_AT_MS,
  FLASH_MS,
  HAIRLINE_AT_MS,
  HAIRLINE_MS,
  MIN_VISUAL_PCT,
  SETTLE_DELAYS_MS,
  STAMP_AT_MS,
  STAMP_BLEED_AT_MS,
  STAMP_BLEED_MS,
  STAMP_MS,
  UNDERDOG_MAX_EXPECTED_PCT,
  VERDICT_TOTAL_MS,
  WASH_MS,
  isUnderdogWin,
  visualSplit,
} from './verdict-timing'

describe('visualSplit — suelo visual de la aguada', () => {
  it('respeta el porcentaje real en la zona legible', () => {
    expect(visualSplit(50)).toBe(50)
    expect(visualSplit(MIN_VISUAL_PCT)).toBe(MIN_VISUAL_PCT)
    expect(visualSplit(100 - MIN_VISUAL_PCT)).toBe(100 - MIN_VISUAL_PCT)
  })

  it('clava el suelo y el techo en los extremos (99/1 se pinta con suelo)', () => {
    expect(visualSplit(0)).toBe(MIN_VISUAL_PCT)
    expect(visualSplit(1)).toBe(MIN_VISUAL_PCT)
    expect(visualSplit(100)).toBe(100 - MIN_VISUAL_PCT)
    expect(visualSplit(99)).toBe(100 - MIN_VISUAL_PCT)
  })

  it('los dos lados siempre suman 100 (la balanza no deja huecos)', () => {
    for (let pctA = 0; pctA <= 100; pctA += 1) {
      expect(visualSplit(pctA) + visualSplit(100 - pctA)).toBe(100)
    }
  })
})

describe('isUnderdogWin — el destello solo con dato real', () => {
  it('ruge si el ganador partía con el prior en el umbral o por debajo', () => {
    expect(isUnderdogWin(UNDERDOG_MAX_EXPECTED_PCT)).toBe(true)
    expect(isUnderdogWin(0)).toBe(true)
  })

  it('no ruge por encima del umbral', () => {
    expect(isUnderdogWin(UNDERDOG_MAX_EXPECTED_PCT + 0.1)).toBe(false)
    expect(isUnderdogWin(50)).toBe(false)
  })

  it('sin dato no hay destello: null, undefined y NaN apagan la señal', () => {
    expect(isUnderdogWin(null)).toBe(false)
    expect(isUnderdogWin(undefined)).toBe(false)
    expect(isUnderdogWin(Number.NaN)).toBe(false)
  })
})

describe('escalera del veredicto — coherencia interna', () => {
  it('la hairline nace exactamente cuando asientan las aguadas', () => {
    expect(HAIRLINE_AT_MS).toBe(WASH_MS)
  })

  it('los delays relativos a settle reproducen los tiempos absolutos', () => {
    expect(SETTLE_DELAYS_MS).toEqual({
      hairline: 0,
      flash: FLASH_AT_MS - HAIRLINE_AT_MS,
      breath: BREATH_AT_MS - HAIRLINE_AT_MS,
      stamp: STAMP_AT_MS - HAIRLINE_AT_MS,
      bleed: STAMP_BLEED_AT_MS - HAIRLINE_AT_MS,
    })
    expect(Object.isFrozen(SETTLE_DELAYS_MS)).toBe(true)
  })

  it('ninguna fase termina después del total declarado', () => {
    const finales = [
      WASH_MS,
      HAIRLINE_AT_MS + HAIRLINE_MS,
      BREATH_AT_MS + BREATH_MS,
      STAMP_AT_MS + STAMP_MS,
      STAMP_BLEED_AT_MS + STAMP_BLEED_MS,
      FLASH_AT_MS + FLASH_MS,
    ]
    expect(VERDICT_TOTAL_MS).toBe(Math.max(...finales))
  })
})
