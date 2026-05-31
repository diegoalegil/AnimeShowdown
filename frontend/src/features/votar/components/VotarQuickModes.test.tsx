import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import VotarQuickModes from './VotarQuickModes'

afterEach(() => cleanup())

const a = {
  slug: 'luffy',
  nombre: 'Monkey D. Luffy',
  anime: 'One Piece',
}

const b = {
  slug: 'zoro',
  nombre: 'Roronoa Zoro',
  anime: 'One Piece',
}

function renderModes(blindMode = false) {
  render(
    <MemoryRouter>
      <VotarQuickModes
        a={a}
        b={b}
        fixedAnime="One Piece"
        fixedPersonaje={null}
        hasFixedAnime
        hasFixedDuel={false}
        blindMode={blindMode}
      />
    </MemoryRouter>,
  )
}

describe('VotarQuickModes blind mode', () => {
  it('no muestra nombres ni anime cuando el duelo esta oculto', () => {
    renderModes(true)

    expect(screen.queryByText('One Piece')).not.toBeInTheDocument()
    expect(screen.queryByText('Monkey D. Luffy vs Roronoa Zoro')).not.toBeInTheDocument()
    expect(screen.getByText('Identidad oculta')).toBeInTheDocument()
    expect(screen.getByText('Duelo oculto')).toBeInTheDocument()
  })

  it('mantiene los detalles visibles fuera del modo a ciegas', () => {
    renderModes(false)

    expect(screen.getByText('One Piece')).toBeInTheDocument()
    expect(screen.getByText('Monkey D. Luffy vs Roronoa Zoro')).toBeInTheDocument()
  })
})
