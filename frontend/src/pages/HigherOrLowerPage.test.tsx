import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

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

beforeEach(() => {
  globalThis.localStorage?.clear?.()
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HigherOrLowerPage feedback accesible', () => {
  it('anuncia textual y persistentemente el resultado de la ronda', () => {
    render(
      <MemoryRouter>
        <HigherOrLowerPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('status', { name: /resultado del elo duel/i }),
    ).toHaveTextContent(
      'Ronda lista: decide si Roronoa Zoro tiene más o menos ELO que Monkey D. Luffy.',
    )

    fireEvent.click(screen.getByRole('button', { name: /más elo/i }))

    expect(
      screen.getByRole('status', { name: /resultado del elo duel/i }),
    ).toHaveTextContent(
      'Correcto: Roronoa Zoro tiene más ELO que Monkey D. Luffy. Racha actual: 1.',
    )
  })
})
