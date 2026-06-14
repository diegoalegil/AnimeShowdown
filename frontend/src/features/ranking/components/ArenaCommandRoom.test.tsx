import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { SoundProvider } from '../../../contexts/SoundContext'
import { ArenaCommandRoom } from './ArenaCommandRoom'

// lib/sounds toca Web Audio; se mockea (SoundProvider llama a __warm, la sala a playClack).
vi.mock('../../../lib/sounds', () => ({
  __warm: vi.fn(),
  playClack: vi.fn(),
}))

const catalogo = [
  { anime: 'One Piece', slug: 'one-piece', personajes: [1, 2, 3, 4] },
  { anime: 'Naruto', slug: 'naruto', personajes: [1, 2, 3] },
]

function renderACR(props = {}) {
  return render(
    <SoundProvider>
      <MemoryRouter>
        <ArenaCommandRoom catalogo={catalogo} votos={[]} {...props} />
      </MemoryRouter>
    </SoundProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ArenaCommandRoom', () => {
  it('pinta la cabecera y un territorio por anime del catálogo', () => {
    renderACR()
    expect(
      screen.getByRole('heading', { name: 'La sala de mando' }),
    ).toBeInTheDocument()
    expect(screen.getByText('One Piece')).toBeInTheDocument()
    expect(screen.getByText('Naruto')).toBeInTheDocument()
  })

  it('sin votos no inventa actividad (el confín en aguas tranquilas)', () => {
    renderACR({ votos: [] })
    expect(screen.getByText('aguas tranquilas')).toBeInTheDocument()
  })
})
