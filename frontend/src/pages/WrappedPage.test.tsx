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

describe('WrappedPage', () => {
  beforeEach(() => {
    h.user = { username: 'goku', id: 1 }
    h.miWrapped.mockReset()
  })
  afterEach(() => cleanup())

  it('muestra las cifras, el personaje top y el bloque de compartir', async () => {
    h.miWrapped.mockResolvedValue({
      username: 'goku',
      votosTotales: 42,
      duelosJugados: 10,
      prediccionesAcertadas: 5,
      badgesDesbloqueados: 7,
      personajeTop: { slug: 'gohan', nombre: 'Gohan', anime: 'Dragon Ball', imagenUrl: '/img/gohan.webp' },
      fandomPrincipal: 'Dragon Ball',
    })
    renderPage()

    expect(await screen.findByText('@goku')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Votos emitidos')).toBeInTheDocument()
    expect(screen.getByText('Gohan')).toBeInTheDocument()
    expect(screen.getByText('Comparte tu Wrapped')).toBeInTheDocument()
  })

  it('redirige a /login si no hay usuario', () => {
    h.user = null
    renderPage()
    expect(screen.queryByText('Tu año en AnimeShowdown')).not.toBeInTheDocument()
  })
})
