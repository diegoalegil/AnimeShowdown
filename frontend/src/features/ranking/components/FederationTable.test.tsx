import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import FederationTable from './FederationTable'

afterEach(() => cleanup())

const filas = [
  { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball', elo: 1480 },
  { slug: 'monkey-d-luffy', nombre: 'Luffy', anime: 'One Piece', elo: 1455 },
  { slug: 'naruto-uzumaki', nombre: 'Naruto', anime: 'Naruto', elo: 1430 },
]

function renderTabla(props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <FederationTable items={filas} scrollMode="page" {...props} />
    </MemoryRouter>,
  )
}

describe('FederationTable', () => {
  it('pinta una tabla real con caption y una placa por combatiente', () => {
    renderTabla()
    expect(screen.getByRole('table', { name: /Registro de la Federación/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Goku de Dragon Ball, ELO 1480/ })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4) // cabecera + 3 placas
  })

  it('respeta rankBase: bajo el podio la lista arranca en el puesto 4', () => {
    renderTabla({ rankBase: 4 })
    expect(screen.getByText('04')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Puesto 4 — Goku/ })).toBeInTheDocument()
    expect(screen.queryByText('01')).toBeNull()
  })

  it('conserva el ancla del tour (data-tour="rank-row" + data-slug)', () => {
    const { container } = renderTabla()
    expect(container.querySelector('[data-tour="rank-row"][data-slug="goku"]')).not.toBeNull()
  })

  it('loading pinta la piel .skl sin placas reales', () => {
    const { container } = render(
      <MemoryRouter>
        <FederationTable items={[]} loading scrollMode="page" />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.fed-skl-row').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('vacío de búsqueda: copy honesto + CTA que limpia los filtros', () => {
    const onClearSearch = vi.fn()
    render(
      <MemoryRouter>
        <FederationTable items={[]} vacioMotivo="busqueda" onClearSearch={onClearSearch} />
      </MemoryRouter>,
    )
    expect(screen.getByText('El registro no encontró ese combatiente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(onClearSearch).toHaveBeenCalledTimes(1)
  })

  it('la fila propia lleva el chip «tú» y el borde de oro (data-you)', () => {
    const { container } = renderTabla({ usuarioSlug: 'monkey-d-luffy' })
    expect(screen.getByText('tú')).toBeInTheDocument()
    expect(container.querySelector('[data-you][data-slug="monkey-d-luffy"]')).not.toBeNull()
  })
})
