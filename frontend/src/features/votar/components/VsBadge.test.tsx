import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import VsBadge from './VsBadge'

afterEach(() => cleanup())

describe('VsBadge', () => {
  it('renderiza el VS sin chispa en reposo', () => {
    const { container } = render(<VsBadge votedFor={null} />)
    expect(screen.getByText('VS')).toBeInTheDocument()
    expect(container.querySelector('[data-vs-tie-spark]')).not.toBeInTheDocument()
  })

  it('no emite chispa en un voto normal', () => {
    const { container } = render(<VsBadge votedFor="luffy" />)
    expect(container.querySelector('[data-vs-tie-spark]')).not.toBeInTheDocument()
  })

  it('en empate emite la chispa de choque decorativa', () => {
    const { container } = render(<VsBadge votedFor="__empate__" isTie />)
    const spark = container.querySelector('[data-vs-tie-spark]')
    expect(spark).toBeInTheDocument()
    expect(spark).toHaveAttribute('aria-hidden', 'true')
    expect(spark?.className).toContain('pointer-events-none')
  })
})
