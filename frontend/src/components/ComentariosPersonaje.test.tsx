import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return {
    ApiError,
    user: { value: null as null | { id: number; username: string } },
    play: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
    endpoints: {
      comentariosPersonaje: vi.fn(),
      crearComentarioPersonaje: vi.fn(),
      reportarComentario: vi.fn(),
    },
  }
})

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: h.user.value }),
}))
vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: h.play, warm: vi.fn() }),
}))
vi.mock('../lib/api', () => ({ endpoints: h.endpoints, ApiError: h.ApiError }))

import ComentariosPersonaje from './ComentariosPersonaje'

function page(content: unknown[], extra: Record<string, unknown> = {}) {
  return { content, last: true, number: 0, totalElements: content.length, ...extra }
}

function renderMuro() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ComentariosPersonaje slug="goku" nombre="Goku" />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('ComentariosPersonaje (Muro de voces)', () => {
  beforeEach(() => {
    h.user.value = null
    h.play.mockReset()
    h.toast.success.mockReset()
    h.toast.error.mockReset()
    h.toast.message.mockReset()
    h.endpoints.comentariosPersonaje.mockReset()
    h.endpoints.crearComentarioPersonaje.mockReset()
    h.endpoints.reportarComentario.mockReset()
  })
  afterEach(() => cleanup())

  it('pinta el muro con una lista de varias voces', async () => {
    h.user.value = { id: 1, username: 'goku' }
    h.endpoints.comentariosPersonaje.mockResolvedValue(
      page([
        { id: 10, autor: { id: 2, username: 'krilin' }, creadoEn: '2024-01-01T10:00:00Z', contenido: 'Qué grande' },
        { id: 11, autor: { id: 3, username: 'piccolo' }, creadoEn: '2024-01-02T10:00:00Z', contenido: 'De acuerdo' },
        { id: 12, autor: { id: 4, username: 'vegeta' }, creadoEn: '2024-01-03T10:00:00Z', contenido: 'Hmpf' },
      ]),
    )
    renderMuro()
    expect(await screen.findByText('Qué grande')).toBeInTheDocument()
    expect(screen.getByText('De acuerdo')).toBeInTheDocument()
    expect(screen.getByText('Hmpf')).toBeInTheDocument()
    // Tres tiras de voz.
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('con sesión muestra el pincel para escribir', async () => {
    h.user.value = { id: 1, username: 'goku' }
    h.endpoints.comentariosPersonaje.mockResolvedValue(page([]))
    renderMuro()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dejar voz' })).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Escribe tu voz')).toBeInTheDocument()
  })

  it('como invitado sella el muro y ofrece entrar al dojo', async () => {
    h.user.value = null
    h.endpoints.comentariosPersonaje.mockResolvedValue(page([]))
    renderMuro()
    expect(
      await screen.findByText(/El muro está sellado para visitantes/i),
    ).toBeInTheDocument()
    // Sin pincel para invitados.
    expect(screen.queryByRole('button', { name: 'Dejar voz' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Entrar al dojo/i })).toBeInTheDocument()
  })

  it('con el muro vacío invita a ser la primera voz', async () => {
    h.user.value = { id: 1, username: 'goku' }
    h.endpoints.comentariosPersonaje.mockResolvedValue(page([]))
    renderMuro()
    expect(await screen.findByText('Sé la primera voz.')).toBeInTheDocument()
  })

  it('si la carga falla muestra un error, NO "sé la primera voz"', async () => {
    h.user.value = { id: 1, username: 'goku' }
    h.endpoints.comentariosPersonaje.mockRejectedValue(new h.ApiError('boom', 500))
    renderMuro()
    // El estado de error es honesto y accesible (role=alert), no finge "no hay
    // comentarios todavía".
    expect(
      await screen.findByText('No se pudieron cargar los comentarios.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Sé la primera voz.')).not.toBeInTheDocument()
  })
})
