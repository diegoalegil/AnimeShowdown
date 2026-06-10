import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import VotarShortcutsFooter from './VotarShortcutsFooter'

afterEach(() => cleanup())

function renderFooter(props: { votedFor?: string | null; sinMatchesAbiertos?: boolean } = {}) {
  render(
    <MemoryRouter>
      <VotarShortcutsFooter
        votedFor={props.votedFor ?? null}
        sinMatchesAbiertos={props.sinMatchesAbiertos ?? false}
      />
    </MemoryRouter>,
  )
}

describe('VotarShortcutsFooter', () => {
  it('muestra el atajo Espacio solo cuando ya hay voto', () => {
    renderFooter()
    expect(screen.queryByText('Espacio')).toBeNull()
    cleanup()
    renderFooter({ votedFor: 'luffy' })
    expect(screen.getByText('Espacio')).toBeTruthy()
  })

  it('ofrece el link a torneos solo sin matches abiertos', () => {
    renderFooter()
    expect(screen.queryByText(/Ver torneos disponibles/)).toBeNull()
    cleanup()
    renderFooter({ sinMatchesAbiertos: true })
    expect(screen.getByText(/Ver torneos disponibles/)).toBeTruthy()
  })
})
