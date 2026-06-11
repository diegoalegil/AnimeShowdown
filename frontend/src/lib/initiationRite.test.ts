import { afterEach, describe, expect, it } from 'vitest'

import {
  markInitiationRiteSeen,
  RITE_T,
  riteTimings,
  shouldRunInitiationRite,
} from './initiationRite'

afterEach(() => {
  localStorage.clear()
})

describe('one-shot del rito', () => {
  it('toca ceremonia solo la primera vez', () => {
    expect(shouldRunInitiationRite()).toBe(true)
    markInitiationRiteSeen()
    expect(shouldRunInitiationRite()).toBe(false)
  })
})

describe('riteTimings', () => {
  it('respeta el presupuesto total hasta 20 caracteres', () => {
    for (const n of [1, 3, 8, 20]) {
      const { exitAt } = riteTimings(n)
      expect(exitAt, `${n} caracteres`).toBeLessThanOrEqual(RITE_T.budget)
    }
  })

  it('con el username máximo (30) el clamp de legibilidad solo desborda unas décimas', () => {
    // El stagger nunca baja de staggerMin aunque rompa el presupuesto: mejor
    // 60ms extra que un acuñado ilegible. Acotamos el desborde.
    const { exitAt, stagger } = riteTimings(30)
    expect(stagger).toBe(RITE_T.staggerMin)
    expect(exitAt).toBeLessThanOrEqual(RITE_T.budget + 100)
  })

  it('el stagger vive dentro de sus límites y se encoge con el largo', () => {
    const corto = riteTimings(6)
    const largo = riteTimings(24)
    expect(corto.stagger).toBeLessThanOrEqual(RITE_T.staggerMax)
    expect(largo.stagger).toBeGreaterThanOrEqual(RITE_T.staggerMin)
    expect(largo.stagger).toBeLessThanOrEqual(corto.stagger)
  })

  it('el orden de la coreografía es estable: chars → hanko → sfx → salida', () => {
    const { hankoAt, sfxAt, exitAt } = riteTimings(8)
    expect(hankoAt).toBeGreaterThan(RITE_T.charsStart)
    expect(sfxAt).toBeGreaterThan(hankoAt)
    expect(exitAt).toBeGreaterThan(sfxAt)
  })
})
