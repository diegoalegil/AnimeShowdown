import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useVotarPreferences } from './useVotarPreferences'

describe('useVotarPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('fastMode es opt-out: activo por defecto y solo "false" explicito lo apaga', () => {
    const { result } = renderHook(() => useVotarPreferences())
    expect(result.current.fastMode).toBe(true)

    localStorage.setItem('animeshowdown.votar.fast', 'false')
    const apagado = renderHook(() => useVotarPreferences())
    expect(apagado.result.current.fastMode).toBe(false)
  })

  it('blindMode es opt-in: apagado por defecto', () => {
    const { result } = renderHook(() => useVotarPreferences())
    expect(result.current.blindMode).toBe(false)
  })

  it('persiste los toggles y sincroniza fastModeRef', () => {
    const { result } = renderHook(() => useVotarPreferences())

    act(() => result.current.setFastMode(false))
    expect(localStorage.getItem('animeshowdown.votar.fast')).toBe('false')
    expect(result.current.fastModeRef.current).toBe(false)

    act(() => result.current.setBlindMode(true))
    expect(localStorage.getItem('animeshowdown.votar.blind')).toBe('true')
  })
})
