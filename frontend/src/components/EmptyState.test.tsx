import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import EmptyState from './EmptyState'

afterEach(() => cleanup())

describe('EmptyState', () => {
  it('renderiza acciones estructuradas como enlace', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <EmptyState
          title="Inicia sesión para coleccionar"
          action={{ to: '/login', label: 'Entrar' }}
        />
      </MemoryRouter>,
    )

    expect(getByRole('link', { name: /entrar/i })).toHaveAttribute('href', '/login')
  })

  it('no renderiza objetos de acción incompletos como hijos React', () => {
    expect(() => {
      render(
        <MemoryRouter>
          <EmptyState
            title="No pudimos cargar tu colección"
            action={{ to: '/login', label: null }}
          />
        </MemoryRouter>,
      )
    }).not.toThrow()
  })
})
