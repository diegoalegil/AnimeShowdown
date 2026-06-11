import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnimesPage from './AnimesPage'

vi.mock('../hooks/useSeo', () => ({
  useSeo: vi.fn(),
}))

vi.mock('../components/JsonLd', () => ({
  default: () => null,
}))

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
}))

vi.mock('../components/SugerirPersonajeCTA', () => ({
  default: () => null,
}))

vi.mock('../components/LazyOnView', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../components/BrandSelect', () => ({
  default: ({ ariaLabel }: { ariaLabel: string }) => <select aria-label={ariaLabel} />,
}))

vi.mock('../components/EditorialCover', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CinematicHero: () => <div />,
}))

vi.mock('../data/visual-assets', () => ({
  BRAND_VISUALS: { animes: {}, empty: {} },
}))

vi.mock('../data/anime-visual', () => ({
  getAnimeVisual: () => ({ accentRgb: '1 2 3' }),
}))

vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({
    personajes: [
      {
        slug: 'luffy',
        nombre: 'Luffy',
        anime: 'One Piece',
        elo: 1000,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

describe('AnimesPage', () => {
  afterEach(cleanup)

  it('mantiene 44px para limpiar la busqueda', () => {
    render(
      <MemoryRouter>
        <AnimesPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar animes/i }), {
      target: { value: 'one' },
    })

    const limpiar = screen.getByRole('button', { name: /Limpiar búsqueda/i })
    expect(limpiar).toHaveClass('h-11')
    expect(limpiar).toHaveClass('w-11')
  })
})
