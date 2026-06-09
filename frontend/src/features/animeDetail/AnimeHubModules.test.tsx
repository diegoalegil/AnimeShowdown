import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AnimeHubModules from './AnimeHubModules'

const rankingSegmentadoMock = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useRanking', () => ({
  useRankingSegmentado: (params: unknown) => rankingSegmentadoMock(params),
  useRankingMovimientos: () => ({ data: [] }),
}))

vi.mock('../../hooks/usePersonajesSimilares', () => ({
  usePersonajesSimilares: () => ({ data: [] }),
}))

vi.mock('../../lib/torneosQueries', () => ({
  useTorneos: () => ({ data: [] }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const personajes = [
  { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece', elo: 1800 },
  { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece', elo: 1750 },
]

describe('AnimeHubModules', () => {
  beforeEach(() => {
    rankingSegmentadoMock.mockReset()
    rankingSegmentadoMock.mockReturnValue({ data: [], isLoading: false })
  })

  it('pide el ranking mensual acotado al anime actual', () => {
    render(
      <MemoryRouter>
        <AnimeHubModules
          anime="One Piece"
          personajes={personajes}
          porElo={personajes}
          slug="one-piece"
          topElo={personajes[0]}
        />
      </MemoryRouter>,
    )

    expect(rankingSegmentadoMock).toHaveBeenCalledWith({
      anime: 'One Piece',
      limit: 8,
      enabled: true,
    })
    expect(rankingSegmentadoMock).toHaveBeenCalledWith({
      periodo: 'mes',
      anime: 'One Piece',
      limit: 50,
      enabled: true,
    })
  })
})
