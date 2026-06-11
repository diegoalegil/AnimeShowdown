import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import VoteStreakBadge from './VoteStreakBadge'
import { getStreakTier } from '../vote-streak'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { total?: number }) =>
      key === 'votar.racha.etiqueta'
        ? `RACHA ×${opts?.total}`
        : `Racha de ${opts?.total} votos en esta sesión`,
  }),
}))

afterEach(() => cleanup())

describe('getStreakTier', () => {
  it('escala por tramos: base, oro, eléctrica y legendaria', () => {
    expect(getStreakTier(3)).toBe('base')
    expect(getStreakTier(4)).toBe('base')
    expect(getStreakTier(5)).toBe('oro')
    expect(getStreakTier(9)).toBe('oro')
    expect(getStreakTier(10)).toBe('electrica')
    expect(getStreakTier(24)).toBe('electrica')
    expect(getStreakTier(25)).toBe('legendaria')
    expect(getStreakTier(120)).toBe('legendaria')
  })
})

describe('VoteStreakBadge', () => {
  it('no aparece por debajo de 3 votos', () => {
    const { container } = render(<VoteStreakBadge total={2} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('aparece a partir de 3 votos con el contador y el aria-label', () => {
    render(<VoteStreakBadge total={3} />)
    const badge = screen.getByRole('img', {
      name: 'Racha de 3 votos en esta sesión',
    })
    expect(badge).toHaveAttribute('data-tier', 'base')
    expect(badge).toHaveTextContent('RACHA ×3')
    expect(badge.className).toContain('pointer-events-none')
  })

  it('sube de tramo visual con la racha', () => {
    const { rerender } = render(<VoteStreakBadge total={5} />)
    expect(screen.getByRole('img')).toHaveAttribute('data-tier', 'oro')

    rerender(<VoteStreakBadge total={10} />)
    expect(screen.getByRole('img')).toHaveAttribute('data-tier', 'electrica')

    rerender(<VoteStreakBadge total={25} />)
    const legendaria = screen.getByRole('img')
    expect(legendaria).toHaveAttribute('data-tier', 'legendaria')
    expect(legendaria).toHaveTextContent('RACHA ×25')
  })
})
