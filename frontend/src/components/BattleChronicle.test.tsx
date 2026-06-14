import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import BattleChronicle from './BattleChronicle'

// PersonajeImg arrastra el catálogo de personajes y srcset responsive;
// para el smoke de la crónica solo nos importa que pinte algo accesible.
import { vi } from 'vitest'
vi.mock('./PersonajeImg', () => ({
  default: ({ alt = '' }: { alt?: string }) => (
    <span role="img" aria-label={alt} />
  ),
}))

type Combate = {
  id: string
  rival: { slug: string; nombre: string; anime?: string }
  resultado: 'victoria' | 'derrota'
  deltaElo?: number
  fechaISO: string
}

const AHORA = Date.parse('2026-06-10T12:00:00.000Z')

function combatesFixture(): Combate[] {
  return [
    { id: '1', rival: { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' }, resultado: 'victoria', fechaISO: '2026-06-09T12:00:00.000Z' },
    { id: '2', rival: { slug: 'zoro', nombre: 'Zoro', anime: 'One Piece' }, resultado: 'victoria', fechaISO: '2026-06-08T12:00:00.000Z' },
    { id: '3', rival: { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball' }, resultado: 'derrota', fechaISO: '2026-06-07T12:00:00.000Z' },
  ]
}

afterEach(() => cleanup())

describe('BattleChronicle', () => {
  it('renderiza una fila por combate con su sello y récord computado', () => {
    render(<BattleChronicle combates={combatesFixture()} ahora={AHORA} />)

    // Una fila <li> por combate.
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    // Récord 2勝 · 1負 computado del array (no hardcodeado); plural correcto.
    expect(screen.getByLabelText('2 victorias, 1 derrota')).toBeInTheDocument()

    // aria-label completo por fila (sin cláusula de ELO: deltaElo ausente).
    expect(
      screen.getByLabelText(/Victoria contra Luffy \(One Piece\)/),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Derrota contra Goku \(Dragon Ball\)/),
    ).toBeInTheDocument()
  })

  it('muestra el delta de ELO cuando viene en los datos', () => {
    const combates = combatesFixture()
    combates[0].deltaElo = 24
    render(<BattleChronicle combates={combates} ahora={AHORA} />)

    expect(
      screen.getByLabelText(/Victoria contra Luffy.*más 24 puntos de ELO/),
    ).toBeInTheDocument()
  })

  it('pinta el estado vacío cuando no hay combates', () => {
    render(<BattleChronicle combates={[]} />)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(
      screen.getByText('La crónica espera su primera página.'),
    ).toBeInTheDocument()
  })
})
