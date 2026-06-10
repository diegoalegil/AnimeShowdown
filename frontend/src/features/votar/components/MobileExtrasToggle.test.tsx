import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import MobileExtrasToggle from './MobileExtrasToggle'

vi.mock('./VotarQuickModes', () => ({
  default: (props: { blindMode?: boolean }) => (
    <div data-testid="quick-modes" data-blind={String(props.blindMode)} />
  ),
}))

vi.mock('../../../components/DailyMissionPanel', () => ({
  default: () => <div data-testid="daily-mission" />,
}))

afterEach(() => cleanup())

describe('MobileExtrasToggle', () => {
  it('expande y contrae los extras', () => {
    render(
      <MobileExtrasToggle
        a={null}
        b={null}
        fixedAnime={null}
        fixedPersonaje={null}
        exactDuelActive={false}
        hasFixedAnime={false}
        blindMode={false}
      />,
    )
    expect(screen.queryByTestId('quick-modes')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Más opciones/ }))
    expect(screen.getByTestId('quick-modes')).toBeTruthy()
    expect(screen.getByTestId('daily-mission')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Ocultar opciones/ }))
    expect(screen.queryByTestId('quick-modes')).toBeNull()
  })

  it('propaga blindMode a los modos rapidos', () => {
    render(
      <MobileExtrasToggle
        a={null}
        b={null}
        fixedAnime={null}
        fixedPersonaje={null}
        exactDuelActive={false}
        hasFixedAnime={false}
        blindMode
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Más opciones/ }))
    expect(screen.getByTestId('quick-modes').dataset.blind).toBe('true')
  })
})
