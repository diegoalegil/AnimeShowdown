import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import QuoteScroll from './QuoteScroll'

const cita = {
  content: 'El que se rinde no tiene futuro.',
  character: 'Monkey D. Luffy',
  anime: 'One Piece',
}

afterEach(() => {
  cleanup()
})

describe('QuoteScroll', () => {
  it('no monta nada con status error (jamás cita inventada)', () => {
    const { container } = render(<QuoteScroll status="error" quote={cita} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no monta nada sin cita aunque esté ready (el hueco colapsa)', () => {
    const { container } = render(<QuoteScroll status="ready" quote={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta el esqueleto de pergamino mientras carga', () => {
    const { container } = render(<QuoteScroll status="loading" quote={null} />)
    expect(container.querySelector('.qs-skeleton')).not.toBeNull()
  })

  it('cuelga la cita con comillas 「」, autor, anime y marca de agua', () => {
    render(<QuoteScroll status="ready" quote={cita} />)
    expect(
      screen.getByText((_, el) => el?.className === 'qs-text'),
    ).toHaveTextContent('「El que se rinde no tiene futuro.」')
    expect(screen.getByText('Monkey D. Luffy')).toBeInTheDocument()
    expect(screen.getByText(/One Piece/)).toBeInTheDocument()
    expect(screen.getByText('誓')).toBeInTheDocument()
  })
})
