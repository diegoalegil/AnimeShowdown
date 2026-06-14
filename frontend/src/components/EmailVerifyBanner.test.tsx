import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Verif = 'PENDIENTE' | 'VERIFICADO'

const h = vi.hoisted(() => {
  class ApiError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  }
  return {
    ApiError,
    user: { value: null as null | { id: number; estadoVerificacion: Verif } },
    play: vi.fn(),
    endpoints: { resendVerification: vi.fn() },
  }
})

// El componente NO importa 'sonner' (feedback inline, un solo canal): no se
// mockea ni se asserta contra él para no dar cobertura engañosa.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: h.user.value }),
}))
vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: h.play, warm: vi.fn() }),
}))
vi.mock('../lib/api', () => ({ endpoints: h.endpoints, ApiError: h.ApiError }))

import EmailVerifyBanner from './EmailVerifyBanner'

function pendiente() {
  h.user.value = { id: 1, estadoVerificacion: 'PENDIENTE' }
}

describe('EmailVerifyBanner (El sello pendiente)', () => {
  beforeEach(() => {
    h.user.value = null
    h.play.mockReset()
    h.endpoints.resendVerification.mockReset()
    // matchMedia: la pieza consulta prefers-reduced-motion vía CSS, pero algunos
    // entornos lo tocan en JS; lo dejamos disponible y "sin reduced-motion".
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    try {
      sessionStorage.clear()
      localStorage.clear()
    } catch {
      /* sin storage */
    }
  })
  afterEach(() => cleanup())

  it('no renderiza nada sin user', () => {
    h.user.value = null
    const { container } = render(<EmailVerifyBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no renderiza nada si el usuario ya está verificado', () => {
    h.user.value = { id: 1, estadoVerificacion: 'VERIFICADO' }
    const { container } = render(<EmailVerifyBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza la franja con el sello cuando el email está PENDIENTE', () => {
    pendiente()
    render(<EmailVerifyBanner />)
    expect(screen.getByText('tu sello espera')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    // El botón de reenvío real.
    expect(screen.getByRole('button', { name: /reenviar/i })).toBeInTheDocument()
  })

  it('reenviar llama a resendVerification, suena el clack y entra en cooldown', async () => {
    pendiente()
    h.endpoints.resendVerification.mockResolvedValue(undefined)
    render(<EmailVerifyBanner />)
    const btn = screen.getByRole('button', { name: /reenviar/i })
    await act(async () => {
      btn.click()
    })
    expect(h.endpoints.resendVerification).toHaveBeenCalledTimes(1)
    expect(h.play).toHaveBeenCalledWith('playClack')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /reenviado/i })).toBeInTheDocument(),
    )
  })

  it('si el reenvío rechaza, muestra error inline y ofrece reintentar', async () => {
    pendiente()
    h.endpoints.resendVerification.mockRejectedValue(
      new h.ApiError('Demasiados intentos', 429, {}),
    )
    render(<EmailVerifyBanner />)
    const btn = screen.getByRole('button', { name: /reenviar/i })
    await act(async () => {
      btn.click()
    })
    await waitFor(() =>
      expect(screen.getByText(/no se pudo reenviar/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('la transición PENDIENTE → verificado dispara la ceremonia (playSello) sin crashear', async () => {
    pendiente()
    const { rerender } = render(<EmailVerifyBanner />)
    expect(screen.getByText('tu sello espera')).toBeInTheDocument()
    // El refresh de sesión devuelve el estado actualizado: no→sí.
    h.user.value = { id: 1, estadoVerificacion: 'VERIFICADO' }
    await act(async () => {
      rerender(<EmailVerifyBanner />)
    })
    expect(h.play).toHaveBeenCalledWith('playSello')
    expect(screen.getByText('sello completado')).toBeInTheDocument()
  })

  it('logout (PENDIENTE → sin user) desaparece sin ceremonia ni sonido', async () => {
    pendiente()
    const { rerender, container } = render(<EmailVerifyBanner />)
    expect(screen.getByText('tu sello espera')).toBeInTheDocument()
    // Cerrar sesión sin verificar: user→null. NO es una verificación.
    h.user.value = null
    await act(async () => {
      rerender(<EmailVerifyBanner />)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(h.play).not.toHaveBeenCalledWith('playSello')
    expect(screen.queryByText('sello completado')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('un nuevo login PENDIENTE tras una ceremonia vuelve a mostrar el banner', async () => {
    // Usuario A verifica → ceremonia → la fase llega a su estado absorbente.
    h.user.value = { id: 1, estadoVerificacion: 'PENDIENTE' }
    const { rerender } = render(<EmailVerifyBanner />)
    h.user.value = { id: 1, estadoVerificacion: 'VERIFICADO' }
    await act(async () => {
      rerender(<EmailVerifyBanner />)
    })
    // Usuario B inicia sesión PENDIENTE en la misma pestaña: el banner reaparece.
    h.user.value = { id: 2, estadoVerificacion: 'PENDIENTE' }
    await act(async () => {
      rerender(<EmailVerifyBanner />)
    })
    expect(screen.getByText('tu sello espera')).toBeInTheDocument()
  })
})
