import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Contrato de RegisterPage (el rito de ingreso, RegisterRite). Lo que se
// protege aquí es el FLUJO, no la coreografía:
//  - render del formulario (los 3 pasos + el botón de alta);
//  - validación: campos inválidos NO llaman a registerUser;
//  - submit válido → registerUser con los campos correctos y navigate(next);
//  - error de registro (409 / genérico) → se pinta el aviso y NO se navega.
// La página es un contenedor: mockeamos useAuth (register spy), react-router
// (useNavigate + useSearchParams), useSound, useSeo y el rito de iniciación.

const h = vi.hoisted(() => {
  class ApiError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown = null) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  }
  return {
    ApiError,
    registerUser: vi.fn(),
    navigate: vi.fn(),
    play: vi.fn(),
    searchParams: new URLSearchParams(''),
    toastSuccess: vi.fn(),
  }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ register: h.registerUser }),
}))
vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: h.play, warm: vi.fn(), muted: false, toggleMute: vi.fn() }),
}))
vi.mock('../hooks/useSeo', () => ({ useSeo: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: h.toastSuccess, error: vi.fn() } }))
// Forzamos la rama sin ceremonia (one-shot ya visto): con reduced-motion el
// onSuccess navega directo; aun así dejamos el lib determinista y aislado.
vi.mock('../lib/initiationRite', () => ({
  shouldRunInitiationRite: () => false,
  markInitiationRiteSeen: vi.fn(),
}))
// InitiationRite no debería montarse en estos tests (reduced-motion), pero lo
// stubeamos para no arrastrar su árbol si algún día cambia la rama.
vi.mock('../components/InitiationRite', () => ({ default: () => null }))
// react-router-dom: useNavigate/useSearchParams como spies; Link como stub
// para no necesitar un <Router> de verdad.
vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useSearchParams: () => [h.searchParams],
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>
      {children}
    </a>
  ),
}))

import RegisterPage from './RegisterPage'

const VALIDOS = {
  username: 'diego_kun',
  email: 'diego@correo.com',
  password: 'secreta123',
}

function fill(field: 'username' | 'email' | 'password' | 'confirmPassword', value: string) {
  const labels: Record<string, string | RegExp> = {
    username: 'Nombre de usuario',
    email: 'Email',
    password: 'Contraseña',
    confirmPassword: 'Confirma la contraseña',
  }
  fireEvent.change(screen.getByLabelText(labels[field]), { target: { value } })
}

function sellarJuramento() {
  // El juramento es un checkbox real (#juramento) con cara de sello.
  fireEvent.click(screen.getByRole('checkbox'))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

function rellenarTodo() {
  fill('username', VALIDOS.username)
  fill('email', VALIDOS.email)
  fill('password', VALIDOS.password)
  fill('confirmPassword', VALIDOS.password)
  sellarJuramento()
}

describe('RegisterPage (el rito de ingreso)', () => {
  beforeEach(() => {
    h.registerUser.mockReset()
    h.navigate.mockReset()
    h.play.mockReset()
    h.toastSuccess.mockReset()
    h.searchParams = new URLSearchParams('')
    // matchMedia matches:true → reduced-motion: el foco automático colapsa a
    // un tick inmediato y el post-alta navega directo (sin ceremonia).
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('pinta el formulario del rito: los tres pasos y el botón de alta', () => {
    render(<RegisterPage />)
    expect(screen.getByRole('heading', { name: 'Cruza el rito' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirma la contraseña')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
  })

  it('campos inválidos → no llama a registerUser y muestra errores inline', async () => {
    render(<RegisterPage />)
    fill('username', 'ab') // < 3
    fill('email', 'no-es-email')
    fill('password', 'corta') // < 8 y sin dígito
    fill('confirmPassword', 'otra')
    sellarJuramento()
    submit()
    await waitFor(() => {
      expect(screen.getByText('Mínimo 3 caracteres')).toBeInTheDocument()
    })
    expect(screen.getByText('El email no es válido')).toBeInTheDocument()
    expect(h.registerUser).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('sin sellar el juramento → no llama a registerUser y avisa', async () => {
    render(<RegisterPage />)
    fill('username', VALIDOS.username)
    fill('email', VALIDOS.email)
    fill('password', VALIDOS.password)
    fill('confirmPassword', VALIDOS.password)
    // (no se sella el juramento)
    submit()
    await waitFor(() => {
      expect(
        screen.getByText(/El juramento queda por sellar/i),
      ).toBeInTheDocument()
    })
    expect(h.registerUser).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('submit válido → registerUser con los campos correctos y navega a next', async () => {
    h.registerUser.mockResolvedValue(undefined)
    render(<RegisterPage />)
    rellenarTodo()
    submit()
    await waitFor(() => {
      expect(h.registerUser).toHaveBeenCalledTimes(1)
    })
    expect(h.registerUser).toHaveBeenCalledWith({
      username: VALIDOS.username,
      email: VALIDOS.email,
      password: VALIDOS.password,
      referralCode: undefined,
    })
    await waitFor(() => {
      expect(h.navigate).toHaveBeenCalledWith('/')
    })
  })

  it('respeta ?next= saneado al navegar tras el alta', async () => {
    h.searchParams = new URLSearchParams('next=/torneos')
    h.registerUser.mockResolvedValue(undefined)
    render(<RegisterPage />)
    rellenarTodo()
    submit()
    await waitFor(() => {
      expect(h.navigate).toHaveBeenCalledWith('/torneos')
    })
  })

  it('prefill de ?ref= → registerUser recibe el referralCode', async () => {
    h.searchParams = new URLSearchParams('ref=AMIGO99')
    h.registerUser.mockResolvedValue(undefined)
    render(<RegisterPage />)
    rellenarTodo()
    submit()
    await waitFor(() => {
      expect(h.registerUser).toHaveBeenCalledWith(
        expect.objectContaining({ referralCode: 'AMIGO99' }),
      )
    })
  })

  it('error 409 → pinta el aviso del campo y NO navega', async () => {
    h.registerUser.mockRejectedValue(
      new h.ApiError('conflicto', 409, { campo: 'username' }),
    )
    render(<RegisterPage />)
    rellenarTodo()
    submit()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ese nombre ya tiene dueño en el dojo.',
      )
    })
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('error de red (sin status) → pinta el aviso genérico y NO navega', async () => {
    h.registerUser.mockRejectedValue(new h.ApiError('sin conexión', 0))
    render(<RegisterPage />)
    rellenarTodo()
    submit()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El rito no pudo completarse.',
      )
    })
    expect(h.navigate).not.toHaveBeenCalled()
  })
})
