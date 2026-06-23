import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

// jsdom no tiene WebGL → el componente bifurca SOLO a la rama fallback
// (kanji estático en 2 capas); la escena R3F lazy nunca se descarga aquí.
import DuelCeremony from './DuelCeremony'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DuelCeremony (fallback sin WebGL)', () => {
  it('victoria: pinta 勝, etiqueta y el delta tras el timeline', () => {
    vi.useFakeTimers()
    render(<DuelCeremony outcome="win" delta={24} ratingBefore={1180} onDone={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Victoria' })).toBeInTheDocument()
    expect(screen.getAllByText('勝').length).toBe(2) // ghost + capa nítida
    act(() => {
      vi.advanceTimersByTime(1300)
    })
    expect(screen.getByLabelText('Delta ELO +24')).toBeInTheDocument()
    expect(screen.getByText('1180 → 1204')).toBeInTheDocument()
  })

  it('derrota: pinta 敗 y el CTA entrega onDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<DuelCeremony outcome="lose" delta={-18} ratingBefore={1200} onDone={onDone} />)
    expect(screen.getByRole('dialog', { name: 'Derrota' })).toBeInTheDocument()
    expect(screen.getAllByText('敗').length).toBe(2)
    act(() => {
      vi.advanceTimersByTime(1300)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('Escape cierra la ceremonia', () => {
    const onDone = vi.fn()
    render(<DuelCeremony outcome="win" delta={10} ratingBefore={1000} onDone={onDone} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('victoria con onShare ofrece compartir en el pico (loop viral) y lo invoca', () => {
    const onShare = vi.fn()
    render(<DuelCeremony outcome="win" delta={24} ratingBefore={1180} onDone={() => {}} onShare={onShare} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir victoria' }))
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('derrota NO ofrece compartir (solo se comparte la victoria)', () => {
    render(<DuelCeremony outcome="lose" delta={-18} ratingBefore={1200} onDone={() => {}} onShare={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Compartir victoria' })).toBeNull()
  })
})
