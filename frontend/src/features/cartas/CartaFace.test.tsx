import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import CartaFace from './CartaFace'

vi.mock('../../components/PersonajeImg', () => ({
  default: ({
    alt,
    fit,
    position,
    sizes,
  }: {
    alt?: string
    fit?: string
    position?: string
    sizes?: string
  }) => (
    <span
      role="img"
      aria-label={alt}
      data-testid="carta-personaje-img"
      data-fit={fit}
      data-position={position}
      data-sizes={sizes}
    />
  ),
}))

afterEach(() => cleanup())

describe('CartaFace', () => {
  it('renderiza la carta normal con imagen contenida y srcset acotado', () => {
    render(
      <CartaFace
        carta={{
          personajeSlug: 'luffy',
          personajeNombre: 'Monkey D. Luffy',
          anime: 'One Piece',
          rareza: 'SSR',
          colorDominante: 'var(--color-surface)',
          elo: 1234,
          cantidad: 1,
        }}
      />,
    )

    const img = screen.getByTestId('carta-personaje-img')

    expect(img).toHaveAttribute('data-fit', 'contain')
    expect(img).toHaveAttribute('data-position', 'center')
    expect(img).toHaveAttribute('data-sizes', '(min-width: 768px) 220px, 58vw')
  })
})
