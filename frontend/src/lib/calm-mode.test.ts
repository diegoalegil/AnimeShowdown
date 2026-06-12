import { afterEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CALM_EVENT, CALM_STORAGE_KEY, readStoredCalm } from './calm-mode'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'

describe('calm-mode — lectura compartida', () => {
  afterEach(() => localStorage.removeItem(CALM_STORAGE_KEY))

  it('lee la preferencia persistida (true solo con la cadena exacta)', () => {
    expect(readStoredCalm()).toBe(false)
    localStorage.setItem(CALM_STORAGE_KEY, 'true')
    expect(readStoredCalm()).toBe(true)
    localStorage.setItem(CALM_STORAGE_KEY, 'false')
    expect(readStoredCalm()).toBe(false)
  })
})

describe('useReducedMotionPref — unión SO || calma', () => {
  afterEach(() => localStorage.removeItem(CALM_STORAGE_KEY))

  it('arranca true si la calma estaba persistida (sin tocar el SO)', () => {
    localStorage.setItem(CALM_STORAGE_KEY, 'true')
    const { result } = renderHook(() => useReducedMotionPref())
    expect(result.current).toBe(true)
  })

  it('reacciona en caliente al evento de la linterna', () => {
    const { result } = renderHook(() => useReducedMotionPref())
    expect(result.current).toBe(false)

    act(() => {
      localStorage.setItem(CALM_STORAGE_KEY, 'true')
      window.dispatchEvent(new CustomEvent(CALM_EVENT, { detail: { calm: true } }))
    })
    expect(result.current).toBe(true)

    act(() => {
      localStorage.setItem(CALM_STORAGE_KEY, 'false')
      window.dispatchEvent(new CustomEvent(CALM_EVENT, { detail: { calm: false } }))
    })
    expect(result.current).toBe(false)
  })
})
