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

  it('pinta la escena kanji por defecto (plaza) con role status', () => {
    const { getByRole, getByText } = render(
      <MemoryRouter>
        <EmptyState title="Sin contenido aún" />
      </MemoryRouter>,
    )

    const root = getByRole('status')
    expect(root).toHaveClass('es-root', 'es-s-plaza')
    // El kanji de plaza vive tanto en la escena como en el glifo compacto.
    expect(getByText('祭', { selector: '.es-glyph' })).toBeInTheDocument()
  })

  it('usa role alert y el glifo de desorden en la escena seal', () => {
    const { getByRole, getByText } = render(
      <MemoryRouter>
        <EmptyState escena="seal" title="Algo se rompió" />
      </MemoryRouter>,
    )

    const root = getByRole('alert')
    expect(root).toHaveClass('es-s-seal')
    expect(getByText('乱', { selector: '.es-glyph' })).toBeInTheDocument()
  })

  it('cae a plaza ante una escena desconocida', () => {
    const { getByRole } = render(
      <MemoryRouter>
        {/* @ts-expect-error escena inválida a propósito */}
        <EmptyState escena="inexistente" title="Vacío" />
      </MemoryRouter>,
    )

    expect(getByRole('status')).toHaveClass('es-s-plaza')
  })

  it('mantiene EditorialCover (modo scene) sin glifo kanji', () => {
    const { container, queryByText } = render(
      <MemoryRouter>
        <EmptyState scene title="Portada editorial" />
      </MemoryRouter>,
    )

    // En modo scene no se monta el stage kanji ni el glifo compacto.
    expect(container.querySelector('.es-root')).toBeNull()
    expect(container.querySelector('.es-glyph')).toBeNull()
    expect(queryByText('祭')).toBeNull()
  })
})
