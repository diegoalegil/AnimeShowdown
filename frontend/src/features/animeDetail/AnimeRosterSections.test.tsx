import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import AnimeRosterSections from './AnimeRosterSections'

vi.mock('../../components/PersonajeCard', () => ({
  default: ({
    imagen,
    imagenUrl,
    slug,
  }: {
    imagen?: string
    imagenUrl?: string
    slug: string
  }) => (
    <div
      data-testid="personaje-card"
      data-slug={slug}
      data-src={imagenUrl ?? imagen}
    />
  ),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({
    alt,
    src,
  }: {
    alt?: string
    src?: string
  }) => (
    <span
      aria-label={alt}
      data-testid="ranking-row-img"
      data-src={src}
      role="img"
    />
  ),
}))

describe('AnimeRosterSections', () => {
  it('pasa las fuentes de imagen a cards y filas internas del roster', () => {
    const luffy = {
      slug: 'luffy',
      nombre: 'Monkey D. Luffy',
      anime: 'One Piece',
      elo: 1600,
      imagenUrl: '/img/One_Piece/luffy.webp',
    }
    const zoro = {
      slug: 'zoro',
      nombre: 'Roronoa Zoro',
      anime: 'One Piece',
      elo: 1500,
      imagen: '/img/One_Piece/zoro.webp',
    }

    render(
      <MemoryRouter>
        <AnimeRosterSections
          anime="One Piece"
          destacados={[luffy]}
          personajes={[luffy, zoro]}
          top10={[zoro]}
          total={2}
        />
      </MemoryRouter>,
    )

    const cardSources = screen
      .getAllByTestId('personaje-card')
      .map((node) => [node.getAttribute('data-slug'), node.getAttribute('data-src')])

    expect(cardSources).toContainEqual(['luffy', '/img/One_Piece/luffy.webp'])
    expect(cardSources).toContainEqual(['zoro', '/img/One_Piece/zoro.webp'])
    expect(screen.getByTestId('ranking-row-img')).toHaveAttribute(
      'data-src',
      '/img/One_Piece/zoro.webp',
    )
  })
})
