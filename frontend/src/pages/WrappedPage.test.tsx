import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  user: { username: 'goku', id: 1 } as Record<string, unknown> | null,
  miWrapped: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock('../lib/api', () => ({ endpoints: { miWrapped: h.miWrapped } }))
vi.mock('../components/PersonajeImg', () => ({
  default: ({ nombre }: { nombre: string }) => <img alt={nombre} />,
}))
vi.mock('../components/ShareButtons', () => ({
  default: () => <div data-testid="share-buttons" />,
}))

import WrappedPage from './WrappedPage'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WrappedPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WrappedPage (scrollytelling cinematográfico)', () => {
  beforeEach(() => {
    h.user = { username: 'goku', id: 1 }
    h.miWrapped.mockReset()
  })
  afterEach(() => cleanup())

  it('monta los 6 capítulos con los datos reales del Wrapped', async () => {
    h.miWrapped.mockResolvedValue({
      username: 'goku',
      votosTotales: 1234,
      duelosJugados: 10,
      prediccionesAcertadas: 5,
      badgesDesbloqueados: 7,
      personajeTop: { slug: 'gohan', nombre: 'Gohan', anime: 'Dragon Ball', imagenUrl: '/img/gohan.webp' },
      fandomPrincipal: 'Dragon Ball',
    })
    renderPage()

    // Cover con el username real y los capítulos por su label accesible.
    expect(await screen.findByText(/@goku/)).toBeInTheDocument()
    expect(screen.getByText('El opening de tu temporada')).toBeInTheDocument()
    const capitulos = document.querySelectorAll('[data-screen-label]')
    expect(capitulos.length).toBe(6)
    // El SLAM pinta la cifra real formateada (robusto al separador del ICU).
    expect(
      screen.getAllByText((content) => content.replace(/[\s.,\u00a0]/g, '') === '1234').length,
    ).toBeGreaterThanOrEqual(1)
    // Fandom Nº1 y personaje top reales.
    expect(screen.getByText('Dragon Ball')).toBeInTheDocument()
    expect(screen.getByText('Gohan')).toBeInTheDocument()
    // Capítulo final: la tarjeta exportable.
    expect(screen.getByLabelText(/Tarjeta resumen de tu temporada/)).toBeInTheDocument()
  })

  it('redirige a /login si no hay usuario', () => {
    h.user = null
    renderPage()
    expect(document.querySelector('[data-screen-label]')).not.toBeInTheDocument()
  })
})
