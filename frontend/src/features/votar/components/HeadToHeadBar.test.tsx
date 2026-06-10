import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import HeadToHeadBar from './HeadToHeadBar'

afterEach(() => cleanup())

describe('HeadToHeadBar', () => {
  it('pinta porcentajes redondeados de ganador y perdedor', () => {
    render(
      <HeadToHeadBar
        ganadorNombre="Luffy"
        perdedorNombre="Zoro"
        votosGanador={7}
        votosPerdedor={3}
      />,
    )
    expect(screen.getByText('70%')).toBeTruthy()
    expect(screen.getByText('30%')).toBeTruthy()
    expect(screen.queryByText('¡Duelo reñido!')).toBeNull()
  })

  it('marca como reñido un duelo con ganador por debajo del 60%', () => {
    render(
      <HeadToHeadBar
        ganadorNombre="Luffy"
        perdedorNombre="Zoro"
        votosGanador={5.5}
        votosPerdedor={4.5}
      />,
    )
    expect(screen.getByText('¡Duelo reñido!')).toBeTruthy()
  })

  it('sin votos no renderiza nada', () => {
    const { container } = render(
      <HeadToHeadBar
        ganadorNombre="Luffy"
        perdedorNombre="Zoro"
        votosGanador={0}
        votosPerdedor={0}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
