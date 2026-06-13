import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MemoryRouter } from 'react-router-dom'
import VoteArena from './VoteArena'
import { SoundProvider } from '../../../contexts/SoundContext'

vi.mock('./VoteCard', () => ({
  default: ({ personaje, isTie }: { personaje: { nombre: string }, isTie?: boolean }) => (
    <div data-testid="vote-card" data-tie={isTie ? 'true' : 'false'}>
      {personaje.nombre}
    </div>
  ),
}))

vi.mock('./VsBadge', () => ({
  default: () => <span>VS</span>,
}))

afterEach(() => cleanup())

const a = {
  id: 1,
  slug: 'luffy',
  nombre: 'Luffy',
  anime: 'One Piece',
}

const b = {
  id: 2,
  slug: 'zoro',
  nombre: 'Zoro',
  anime: 'One Piece',
}

describe('VoteArena', () => {
  it('muestra la accion neutral y llama a handleTieVote', () => {
    const handleTieVote = vi.fn()
    render(
      <MemoryRouter>
      <SoundProvider>
      <VoteArena
        a={a}
        b={b}
        votedFor={null}
        voteResult={null}
        controlsDisabled={false}
        votoInvitadoActivo={false}
        handleVoteLeft={() => {}}
        handleVoteRight={() => {}}
        handleTieVote={handleTieVote}
        canTie
      />
      </SoundProvider>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: /no puedo decidir/i })[0])
    expect(handleTieVote).toHaveBeenCalledTimes(1)
  })

  it('marca el empate desde el voto optimista, antes de la respuesta', () => {
    render(
      <MemoryRouter>
      <SoundProvider>
      <VoteArena
        a={a}
        b={b}
        votedFor="__empate__"
        voteResult={null}
        controlsDisabled={false}
        votoInvitadoActivo={false}
        handleVoteLeft={() => {}}
        handleVoteRight={() => {}}
        handleTieVote={() => {}}
        canTie
      />
      </SoundProvider>
      </MemoryRouter>,
    )

    expect(screen.getAllByTestId('vote-card').map((card) => card.dataset.tie)).toEqual([
      'true',
      'true',
    ])
  })

  it('marca ambas cartas como empate cuando el resultado es neutral', () => {
    render(
      <MemoryRouter>
      <SoundProvider>
      <VoteArena
        a={a}
        b={b}
        votedFor="__empate__"
        voteResult={{ empate: true, votosGanador: 0.5, votosPerdedor: 0.5 }}
        controlsDisabled={false}
        votoInvitadoActivo={false}
        handleVoteLeft={() => {}}
        handleVoteRight={() => {}}
        handleTieVote={() => {}}
        canTie
      />
      </SoundProvider>
      </MemoryRouter>,
    )

    expect(screen.getAllByTestId('vote-card').map((card) => card.dataset.tie)).toEqual([
      'true',
      'true',
    ])
  })
})
