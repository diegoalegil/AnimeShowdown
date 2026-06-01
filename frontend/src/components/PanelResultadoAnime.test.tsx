import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { getAnimeIdentity } from '../data/anime-identities'
import PanelResultadoAnime from './PanelResultadoAnime'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      animate,
      children,
      initial,
      transition,
      ...props
    }: {
      animate?: unknown
      children?: ReactNode
      initial?: unknown
      transition?: unknown
    }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('../lib/dailyProgress', () => ({
  recordDailyShare: vi.fn(),
  setDailyGamesCompleted: vi.fn(),
}))

vi.mock('../lib/share', () => ({
  shareOrCopy: vi.fn(),
}))

afterEach(() => cleanup())

describe('PanelResultadoAnime', () => {
  it('expone el resultado completo en una region live atomica', () => {
    render(
      <MemoryRouter>
        <PanelResultadoAnime
          acertado
          titulo="Acertaste en 2/5"
          tier="Precision alta"
          squares={[{ ok: true }, { ok: false }]}
          shareText="Resultado para compartir"
        />
      </MemoryRouter>,
    )

    const status = screen.getByRole('status', {
      name: /resultado del juego: acertaste en 2\/5\. precision alta/i,
    })
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
    expect(status).toHaveTextContent('Acertaste en 2/5')
    expect(status).toHaveTextContent('Precision alta')
  })

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
