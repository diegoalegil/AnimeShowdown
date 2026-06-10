import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_VOTES_COUNT,
  VOTES_COUNT_EVENT,
  incrementarContadorLocalVotos,
} from './vote-local-counter'

describe('incrementarContadorLocalVotos', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mantiene la clave que usa el e2e como ground-truth', () => {
    // animeshowdown.spec.js lee este literal de localStorage — no renombrar.
    expect(STORAGE_VOTES_COUNT).toBe('animeshowdown.votos_count')
    expect(VOTES_COUNT_EVENT).toBe('animeshowdown:votes-count')
  })

  it('incrementa el contador y emite el CustomEvent con el total', () => {
    const oyente = vi.fn()
    window.addEventListener(VOTES_COUNT_EVENT, oyente)

    incrementarContadorLocalVotos()
    incrementarContadorLocalVotos()

    window.removeEventListener(VOTES_COUNT_EVENT, oyente)
    expect(localStorage.getItem(STORAGE_VOTES_COUNT)).toBe('2')
    expect(oyente).toHaveBeenCalledTimes(2)
    expect(oyente.mock.calls[1][0].detail).toBe(2)
  })

  it('un valor corrupto en storage reinicia a 1', () => {
    localStorage.setItem(STORAGE_VOTES_COUNT, 'basura')
    incrementarContadorLocalVotos()
    expect(localStorage.getItem(STORAGE_VOTES_COUNT)).toBe('1')
  })
})
