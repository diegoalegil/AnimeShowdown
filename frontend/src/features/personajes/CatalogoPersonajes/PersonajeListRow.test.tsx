import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PersonajeListRow from './PersonajeListRow'

vi.mock('../../../components/PersonajeImg', () => ({
  default: ({
    colorDominante,
    src,
  }: {
    colorDominante?: string
    src?: string
  }) => (
    <span
      data-testid="personaje-img"
      data-color-dominante={colorDominante}
      data-src={src}
    />
  ),
}))

vi.mock('../../../lib/personajes-core', () => ({
  getStatsPersonaje: () => ({ elo: 1500 }),
}))

afterEach(() => cleanup())

describe('PersonajeListRow', () => {
  it('usa imagenUrl del DTO para no depender del catalogo hidratado', () => {
    render(
      <MemoryRouter>
        <PersonajeListRow
          slug="luffy"
          nombre="Monkey D. Luffy"
          anime="One Piece"
          imagen="/img/One_Piece/luffy-fallback.webp"
          imagenUrl="/img/One_Piece/luffy.webp"
          imagenColorDominante="var(--color-gold)"
        />
      </MemoryRouter>,
    )

    const media = screen.getByTestId('personaje-img')
    expect(media).toHaveAttribute('data-src', '/img/One_Piece/luffy.webp')
    expect(media).toHaveAttribute('data-color-dominante', 'var(--color-gold)')
  })

  it('usa imagen cuando imagenUrl no viene en la respuesta', () => {
    render(
      <MemoryRouter>
        <PersonajeListRow
          slug="zoro"
          nombre="Roronoa Zoro"
          anime="One Piece"
          imagen="/img/One_Piece/zoro.webp"
        />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('personaje-img')).toHaveAttribute(
      'data-src',
      '/img/One_Piece/zoro.webp',
    )
  })
})
