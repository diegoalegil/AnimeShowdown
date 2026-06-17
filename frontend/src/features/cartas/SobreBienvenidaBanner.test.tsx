import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ApiError } from '../../lib/api'
import { SOBRE_ABIERTO_EVENT } from '../../lib/app-events'

// Refs mutables disponibles dentro de las factories hoisted de vi.mock.
const h = vi.hoisted(() => ({
  user: { current: { id: 1, username: 'goku' } as Record<string, unknown> | null },
  coleccion: { current: { sobreBienvenidaDisponible: true } as Record<string, unknown> },
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), message: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: h.user.current }),
}))

vi.mock('../../hooks/useCartas', () => ({
  useColeccionResumen: () => ({ data: h.coleccion.current, refetch: h.refetch }),
  useSobreBienvenida: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
  useDescargarCarta: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
}))

// Evita renderizar la animación pesada de apertura en el test.
vi.mock('./PackOpening', () => ({ default: () => <div data-testid="pack-opening" /> }))

import SobreBienvenidaBanner from './SobreBienvenidaBanner'

describe('SobreBienvenidaBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    h.user.current = { id: 1, username: 'goku' }
    h.coleccion.current = { sobreBienvenidaDisponible: true }
    h.mutateAsync.mockReset()
    h.refetch.mockReset()
    h.toast.info.mockReset()
    h.toast.error.mockReset()
  })

  // El Dialog del intro se renderiza en un portal a document.body; sin cleanup
  // explícito el contenido del test anterior fuga y rompe los asserts de ausencia.
  afterEach(() => cleanup())

  it('auto-abre el modal de intro la primera vez que hay sobre disponible', () => {
    render(<SobreBienvenidaBanner />)
    expect(screen.getByText(/Tienes un sobre especial/i)).toBeInTheDocument()
    // El flag queda persistido para no volver a auto-abrirlo.
    expect(localStorage.getItem('as_welcome_pack_prompted:1')).toBe('1')
  })

  it('no auto-abre el intro si ya se mostró antes (flag en localStorage), pero deja el banner', () => {
    localStorage.setItem('as_welcome_pack_prompted:1', '1')
    render(<SobreBienvenidaBanner />)
    expect(screen.queryByText(/Tienes un sobre especial/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Tu sobre de bienvenida te espera/i)).toBeInTheDocument()
  })

  it('no renderiza nada si no hay sobre disponible', () => {
    h.coleccion.current = { sobreBienvenidaDisponible: false }
    const { container } = render(<SobreBienvenidaBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ante un 409 (ya reclamado) informa y refresca la colección, sin error crudo', async () => {
    // Estado obsoleto: el cliente cree que el sobre está disponible, pero el
    // backend ya lo tenía reclamado y responde 409. No debe salir toast.error.
    localStorage.setItem('as_welcome_pack_prompted:1', '1')
    h.mutateAsync.mockRejectedValueOnce(new ApiError('conflict', 409, null))
    render(<SobreBienvenidaBanner />)

    fireEvent.click(screen.getByRole('button', { name: /Ábrelo gratis/i }))

    await waitFor(() => expect(h.toast.info).toHaveBeenCalledTimes(1))
    expect(h.refetch).toHaveBeenCalledTimes(1)
    expect(h.toast.error).not.toHaveBeenCalled()
  })

  it('ante un error genérico (no 409) sí muestra toast.error', async () => {
    localStorage.setItem('as_welcome_pack_prompted:1', '1')
    h.mutateAsync.mockRejectedValueOnce(new ApiError('boom', 500, null))
    render(<SobreBienvenidaBanner />)

    fireEvent.click(screen.getByRole('button', { name: /Ábrelo gratis/i }))

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledTimes(1))
    expect(h.refetch).not.toHaveBeenCalled()
  })

  it('camino feliz: reclama el sobre, monta el reveal (PackOpening) y emite SOBRE_ABIERTO_EVENT', async () => {
    localStorage.setItem('as_welcome_pack_prompted:1', '1') // suprime el intro
    h.mutateAsync.mockResolvedValueOnce({ cartas: [{ id: 1, poseida: true }] })
    const onEvento = vi.fn()
    window.addEventListener(SOBRE_ABIERTO_EVENT, onEvento)
    try {
      render(<SobreBienvenidaBanner />)
      fireEvent.click(screen.getByRole('button', { name: /Ábrelo gratis/i }))

      expect(await screen.findByTestId('pack-opening')).toBeInTheDocument()
      expect(h.mutateAsync).toHaveBeenCalledTimes(1)
      expect(onEvento).toHaveBeenCalledTimes(1)
      expect(h.toast.error).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(SOBRE_ABIERTO_EVENT, onEvento)
    }
  })

  it('invitado (sin sesión): muestra el regalo con CTA a registro en vez de esconderlo', () => {
    h.user.current = null
    render(
      <MemoryRouter>
        <SobreBienvenidaBanner />
      </MemoryRouter>,
    )
    // El sobre es visible (gancho de conversión), con su copy.
    expect(screen.getByText(/Tu sobre de bienvenida te espera/i)).toBeInTheDocument()
    // El CTA lleva a /register; no intenta reclamar nada (no hay botón "Ábrelo").
    const cta = screen.getByRole('link', { name: /Crea tu cuenta gratis/i })
    expect(cta).toHaveAttribute('href', '/register')
    expect(screen.queryByRole('button', { name: /Ábrelo gratis/i })).not.toBeInTheDocument()
  })
})
