import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { endpoints } from '../lib/api'
import HigherOrLowerPage from './HigherOrLowerPage'

vi.mock('framer-motion', async () => {
  const MotionDiv = ({
    animate,
    children,
    exit,
    initial,
    transition,
    ...props
  }: {
    animate?: unknown
    children?: ReactNode
    exit?: unknown
    initial?: unknown
    transition?: unknown
  }) => <div {...props}>{children}</div>

  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: () => MotionDiv,
      },
    ),
  }
})

vi.mock('../components/JsonLd', () => ({
  default: () => null,
}))

vi.mock('../components/PersonajeImg', () => ({
  default: ({ alt }: { alt?: string }) => <span role="img" aria-label={alt} />,
}))

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
}))

vi.mock('../hooks/useSeo', () => ({
  useSeo: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  endpoints: {
    eloDuelGuess: vi.fn(),
    eloDuelRound: vi.fn(),
  },
}))

vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({
    personajes: [
      { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
      { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
    ],
  }),
}))

vi.mock('../lib/personajes-core', () => ({
  getStatsPersonaje: (slug: string) => ({
    elo: slug === 'zoro' ? 1200 : 1000,
  }),
}))

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  globalThis.localStorage?.clear?.()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.mocked(endpoints.eloDuelRound).mockResolvedValue({
    roundToken: 'round-1',
    reference: { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
    challenger: { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
    referenceElo: 1000,
    scoreLabel: 'ELO competitivo',
    algoritmo: 'test',
    expiresAt: '2026-06-01T00:00:00Z',
  })
  vi.mocked(endpoints.eloDuelGuess).mockResolvedValue({
    correct: true,
    choice: 'HIGHER',
    correctChoice: 'HIGHER',
    referenceElo: 1000,
    challengerElo: 1200,
    eloDiff: 200,
    nextRound: null,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HigherOrLowerPage feedback accesible', () => {
  it('anuncia textual y persistentemente el resultado de la ronda', async () => {
    renderWithProviders(<HigherOrLowerPage />)

    expect(
      await screen.findByRole('status', { name: /resultado del elo duel/i }),
    ).toHaveTextContent(
      'Ronda lista: decide si Roronoa Zoro tiene más o menos ELO competitivo que Monkey D. Luffy.',
    )

    fireEvent.click(screen.getByRole('button', { name: /más elo/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('status', { name: /resultado del elo duel/i }),
      ).toHaveTextContent(
        'Correcto: Roronoa Zoro tiene más ELO competitivo que Monkey D. Luffy. Racha actual: 1.',
      )
    })
  })
})
