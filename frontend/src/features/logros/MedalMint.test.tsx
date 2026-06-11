import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, act } from '@testing-library/react'
import { RARITY, rarezaToKey } from './medal-rarity'

const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>()
  return { ...mod, useReducedMotion: () => reduced.value }
})

import MedalMint from './MedalMint'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  reduced.value = false
})

describe('medal-rarity', () => {
  it('mapea la escalera numérica 1-5 del backend a las variantes', () => {
    expect(rarezaToKey(5)).toBe('legendary')
    expect(rarezaToKey(4)).toBe('epic')
    expect(rarezaToKey(3)).toBe('rare')
    expect(rarezaToKey(2)).toBe('common')
    expect(rarezaToKey(undefined)).toBe('common')
  })

  it('las variantes son acumulativas (legendary lo lleva todo)', () => {
    expect(RARITY.legendary.electric).toBe(true)
    expect(RARITY.legendary.wave2).toBe(true)
    expect(RARITY.common.electric).toBe(false)
  })
})

describe('MedalMint (reduced-motion)', () => {
  it('degrada a toast estático con el kanji real y entrega onDone', () => {
    reduced.value = true
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<MedalMint title="Primer voto" rarity="rare" kanji="初" onDone={onDone} />)
    expect(screen.getByText('Primer voto')).toBeInTheDocument()
    expect(screen.getByText('初')).toBeInTheDocument()
    expect(screen.getByText('rareza · rara')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
