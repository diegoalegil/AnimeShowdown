import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ActividadItem } from './ActividadItem'

afterEach(() => cleanup())

function renderItem(payload: Record<string, unknown>) {
  render(
    <MemoryRouter>
      <ul>
        <ActividadItem
          item={{
            tipo: 'VOTO',
            fecha: '2026-05-31T12:00:00Z',
            payload,
          }}
        />
      </ul>
    </MemoryRouter>,
  )
}

describe('ActividadItem', () => {
  it('renderiza el empate neutral sin atribuir victoria a personaje1', () => {
    renderItem({
      empate: true,
      personajeSlug: 'luffy',
      personajeNombre: 'Luffy',
      oponenteNombre: 'Zoro',
    })

    const item = screen.getByRole('listitem')
    expect(item).toHaveTextContent('No decidió entre Luffy y Zoro')
    expect(item).not.toHaveTextContent('Votó a Luffy')
  })

  it('mantiene el texto de voto normal', () => {
    renderItem({
      empate: false,
      personajeSlug: 'luffy',
      personajeNombre: 'Luffy',
      oponenteNombre: 'Zoro',
    })

    expect(screen.getByRole('listitem')).toHaveTextContent('Votó a Luffy contra Zoro')
  })
})
