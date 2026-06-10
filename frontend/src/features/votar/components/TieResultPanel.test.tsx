import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import TieResultPanel from './TieResultPanel'

afterEach(() => cleanup())

const a = { nombre: 'Monkey D. Luffy' }
const b = { nombre: 'Roronoa Zoro' }

describe('TieResultPanel', () => {
  it('es una region live accesible (sustituye al test de source de VotarPage)', () => {
    render(<TieResultPanel a={a} b={b} voteResult={null} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.getAttribute('aria-atomic')).toBe('true')
  })

  it('sin totales explica el empate neutral', () => {
    render(<TieResultPanel a={a} b={b} voteResult={null} />)
    expect(screen.getByText(/Empate neutral registrado/)).toBeTruthy()
  })

  it('con totales reparte medio voto y pinta la barra', () => {
    render(
      <TieResultPanel
        a={a}
        b={b}
        voteResult={{ votosGanador: 3.5, votosPerdedor: 2.5 }}
      />,
    )
    expect(screen.getByText(/Medio voto para cada lado · 3.5 vs 2.5/)).toBeTruthy()
  })
})
