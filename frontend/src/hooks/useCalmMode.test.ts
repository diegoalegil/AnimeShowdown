import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCalmMode } from './useCalmMode'
import { CALM_STORAGE_KEY } from '../lib/calm-mode'

// La linterna del dojo: estos tests fijan el modelo de estado documentado
// en useCalmMode (calm = SO || usuario, el SO es suelo no-overrideable y
// html.as-calm espeja SOLO la preferencia explícita del usuario).

function mockMatchMedia(matches: boolean) {
  const mq = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mq))
  return mq
}

beforeEach(() => {
  mockMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.removeItem(CALM_STORAGE_KEY)
  document.documentElement.classList.remove('as-calm')
  document.documentElement.removeAttribute('data-calm-pulse')
})

describe('useCalmMode — preferencia explícita del usuario', () => {
  it('arranca con la calma persistida y la espeja en html.as-calm', () => {
    localStorage.setItem(CALM_STORAGE_KEY, 'true')
    const { result } = renderHook(() => useCalmMode())
    expect(result.current.calmUser).toBe(true)
    expect(result.current.calm).toBe(true)
    expect(document.documentElement.classList.contains('as-calm')).toBe(true)
  })

  it('encender persiste, anuncia y pulsa el header un instante', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCalmMode())
    act(() => result.current.toggle())

    expect(result.current.calmUser).toBe(true)
    expect(localStorage.getItem(CALM_STORAGE_KEY)).toBe('true')
    expect(result.current.announcement).toMatch(/calma activado/i)
    expect(document.documentElement.classList.contains('as-calm')).toBe(true)
    expect(document.documentElement.hasAttribute('data-calm-pulse')).toBe(true)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(document.documentElement.hasAttribute('data-calm-pulse')).toBe(false)
  })

  it('apagar no pulsa: el pulso es solo la confirmación de encender', () => {
    localStorage.setItem(CALM_STORAGE_KEY, 'true')
    const { result } = renderHook(() => useCalmMode())
    act(() => result.current.toggle())

    expect(result.current.calmUser).toBe(false)
    expect(localStorage.getItem(CALM_STORAGE_KEY)).toBe('false')
    expect(result.current.announcement).toMatch(/desactivado/i)
    expect(document.documentElement.classList.contains('as-calm')).toBe(false)
    expect(document.documentElement.hasAttribute('data-calm-pulse')).toBe(false)
  })

  it('las instancias se sincronizan por el evento (header + paleta)', () => {
    const a = renderHook(() => useCalmMode())
    const b = renderHook(() => useCalmMode())
    act(() => a.result.current.toggle())
    expect(b.result.current.calmUser).toBe(true)
    expect(b.result.current.calm).toBe(true)
  })

  it('con el storage bloqueado el modo sigue funcionando en sesión', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    const { result } = renderHook(() => useCalmMode())
    act(() => result.current.toggle())
    expect(result.current.calmUser).toBe(true)
    expect(document.documentElement.classList.contains('as-calm')).toBe(true)
    setItem.mockRestore()
  })
})

describe('useCalmMode — el SO como suelo', () => {
  it('reduced-motion del SO enciende calm sin tocar la preferencia', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCalmMode())
    expect(result.current.osReduced).toBe(true)
    expect(result.current.calmUser).toBe(false)
    expect(result.current.calm).toBe(true)
    // la clase espeja SOLO la preferencia del usuario: el SO ya lo cubren
    // las media queries nativas (dos fuentes de verdad divergirían)
    expect(document.documentElement.classList.contains('as-calm')).toBe(false)
  })

  it('con el SO en reduce, toggle es no-op y solo explica', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCalmMode())
    act(() => result.current.toggle())
    expect(result.current.calmUser).toBe(false)
    expect(result.current.calm).toBe(true)
    expect(localStorage.getItem(CALM_STORAGE_KEY)).toBeNull()
    expect(result.current.announcement).toMatch(/brasa/i)
  })

  it('reacciona en caliente al cambio del ajuste del SO', () => {
    const mq = mockMatchMedia(false)
    const { result } = renderHook(() => useCalmMode())
    expect(result.current.calm).toBe(false)

    const handler = mq.addEventListener.mock.calls.find(
      ([event]) => event === 'change',
    )?.[1] as (e: { matches: boolean }) => void
    act(() => handler({ matches: true }))
    expect(result.current.osReduced).toBe(true)
    expect(result.current.calm).toBe(true)
  })
})
