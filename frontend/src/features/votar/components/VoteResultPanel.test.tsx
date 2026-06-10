import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import VoteResultPanel from './VoteResultPanel'

afterEach(() => cleanup())

const luffy = { slug: 'luffy', nombre: 'Monkey D. Luffy' }
const zoro = { slug: 'zoro', nombre: 'Roronoa Zoro' }

function renderPanel(props: Record<string, unknown> = {}) {
  const onShareVote = vi.fn()
  render(
    <MemoryRouter>
      <VoteResultPanel
        votedPersonaje={luffy}
        losingPersonaje={zoro}
        voteResult={null}
        personalVoteImpact={null}
        onShareVote={onShareVote}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onShareVote }
}

describe('VoteResultPanel', () => {
  it('es una region live accesible (sustituye al test de source de VotarPage)', () => {
    renderPanel()
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.getAttribute('aria-atomic')).toBe('true')
    // El e2e ancla en este texto exacto — no cambiar.
    expect(screen.getByText('Monkey D. Luffy ganó tu duelo.')).toBeTruthy()
  })

  it('con totales del backend muestra los votos del ganador y al rival', () => {
    renderPanel({ voteResult: { votosGanador: 7, votosPerdedor: 3 } })
    expect(screen.getByText(/7 votos para Monkey D. Luffy · rival: Roronoa Zoro/)).toBeTruthy()
  })

  it('muestra el impacto personal solo si corresponde al ganador votado', () => {
    renderPanel({ personalVoteImpact: { slug: 'luffy', rank: 2, count: 4 } })
    expect(screen.getByText('#2 en tu ranking personal · 4 votos tuyos')).toBeTruthy()
    cleanup()
    renderPanel({ personalVoteImpact: { slug: 'zoro', rank: 2, count: 4 } })
    expect(screen.queryByText(/ranking personal/)).toBeNull()
  })

  it('la CTA de compartir dispara onShareVote', () => {
    const { onShareVote } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Reta a un amigo/ }))
    expect(onShareVote).toHaveBeenCalledTimes(1)
  })
})
