import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { getAnimeIdentity } from '../data/anime-identities'
import PanelResultadoAnime from './PanelResultadoAnime'

afterEach(() => cleanup())

describe('PanelResultadoAnime', () => {
  it('renderiza la identidad del anime objetivo en el resultado diario', () => {
    render(
      <MemoryRouter>
        <PanelResultadoAnime
          acertado
          titulo="Acertaste en 1/5"
          tier="Precision legendaria"
          squares={[{ ok: true }]}
          shareText="Shadow Guess 1/5"
          identity={getAnimeIdentity('naruto', 'Naruto')}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Naruto · aldea shinobi/i)).toBeInTheDocument()
    expect(screen.getByText('pergamino')).toBeInTheDocument()
    expect(screen.getByText('chakra')).toBeInTheDocument()
  })
})
