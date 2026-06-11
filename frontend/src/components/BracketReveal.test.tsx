import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BracketReveal from './BracketReveal'
import { REVEAL_TIMING } from './bracket-reveal-variants'

describe('REVEAL_TIMING', () => {
  it('mantiene la secuencia línea→pulse→atenuado con solapes de 100ms', () => {
    expect(REVEAL_TIMING.pulse.delay).toBeCloseTo(
      REVEAL_TIMING.path.delay + REVEAL_TIMING.path.duration - 0.1,
    )
    expect(REVEAL_TIMING.dim.delay).toBeCloseTo(
      REVEAL_TIMING.pulse.delay + REVEAL_TIMING.pulse.duration - 0.1,
    )
    expect(REVEAL_TIMING.dim.delay + REVEAL_TIMING.dim.duration).toBeCloseTo(
      REVEAL_TIMING.total,
    )
  })
})

describe('BracketReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renderiza ganador y perdedor sin DOM extra propio', () => {
    render(
      <BracketReveal resolved>
        <BracketReveal.Winner>
          <span>Naruto</span>
        </BracketReveal.Winner>
        <BracketReveal.Loser>
          <span>Luffy</span>
        </BracketReveal.Loser>
      </BracketReveal>,
    )
    expect(screen.getByText('Naruto')).toBeInTheDocument()
    expect(screen.getByText('Luffy')).toBeInTheDocument()
  })

  it('dispara onRevealComplete al acabar la secuencia (800ms), no antes', () => {
    const onComplete = vi.fn()
    render(
      <BracketReveal resolved onRevealComplete={onComplete}>
        <BracketReveal.Winner>
          <span>ganador</span>
        </BracketReveal.Winner>
      </BracketReveal>,
    )
    act(() => {
      vi.advanceTimersByTime(REVEAL_TIMING.total * 1000 - 50)
    })
    expect(onComplete).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('no programa nada mientras el cruce siga sin resolver', () => {
    const onComplete = vi.fn()
    render(
      <BracketReveal resolved={false} onRevealComplete={onComplete}>
        <BracketReveal.Winner>
          <span>pendiente</span>
        </BracketReveal.Winner>
      </BracketReveal>,
    )
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
