import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Refs mutables disponibles dentro de las factories hoisted de vi.mock.
const h = vi.hoisted(() => ({
  coleccion: { current: { sobreBienvenidaDisponible: true } as Record<string, unknown> },
  mutateAsync: vi.fn(),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'goku' } }),
}))

vi.mock('../../hooks/useCartas', () => ({
  useColeccion: () => ({ data: h.coleccion.current }),
  useSobreBienvenida: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
  useDescargarCarta: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
}))

// Evita renderizar la animación pesada de apertura en el test.
vi.mock('./PackOpening', () => ({ default: () => <div data-testid="pack-opening" /> }))

import SobreBienvenidaBanner from './SobreBienvenidaBanner'

describe('SobreBienvenidaBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    h.coleccion.current = { sobreBienvenidaDisponible: true }
    h.mutateAsync.mockReset()
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
})
