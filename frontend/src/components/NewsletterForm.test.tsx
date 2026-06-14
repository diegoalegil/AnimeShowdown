import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    play: vi.fn(),
    endpoints: {
      suscribirNewsletter: vi.fn(),
    },
  }
})

// t devuelve la clave tal cual (suficiente para asertar por clave i18n).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: h.play, warm: vi.fn(), muted: false, toggleMute: vi.fn() }),
}))
vi.mock('../lib/api', () => ({ endpoints: h.endpoints, ApiError: h.ApiError }))

import NewsletterForm from './NewsletterForm'

function getEmail() {
  return screen.getByLabelText('newsletter.emailLabel') as HTMLInputElement
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'newsletter.submit' }))
}

describe('NewsletterForm (estafeta postal)', () => {
  beforeEach(() => {
    h.play.mockReset()
    h.endpoints.suscribirNewsletter.mockReset()
    // Sin animación: reduced-motion → confirmación directa, sin timers.
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

  it('pinta el formulario: intro, campo email y botón suscribir', () => {
    render(<NewsletterForm />)
    expect(screen.getByText('newsletter.intro')).toBeInTheDocument()
    expect(getEmail()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'newsletter.submit' })).toBeInTheDocument()
  })

  it('email vacío → muestra errorRequired y no llama al endpoint', () => {
    render(<NewsletterForm />)
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('newsletter.errorRequired')
    expect(h.endpoints.suscribirNewsletter).not.toHaveBeenCalled()
  })

  it('email con formato inválido → muestra errorInvalido y no llama al endpoint', () => {
    render(<NewsletterForm />)
    fireEvent.change(getEmail(), { target: { value: 'no-es-email' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('newsletter.errorInvalido')
    expect(h.endpoints.suscribirNewsletter).not.toHaveBeenCalled()
  })

  it('email válido → llama a suscribirNewsletter y pinta el mensaje real (doble opt-in)', async () => {
    h.endpoints.suscribirNewsletter.mockResolvedValue({
      message: 'Te hemos enviado un email para confirmar.',
    })
    render(<NewsletterForm />)
    fireEvent.change(getEmail(), { target: { value: 'diego@correo.com' } })
    submit()
    // El mensaje aparece dos veces: en la confirmación visible (.pf-confirm-text)
    // y en la live region SR (role=status). Ambas son correctas.
    await waitFor(() =>
      expect(
        screen.getAllByText('Te hemos enviado un email para confirmar.').length,
      ).toBeGreaterThan(0),
    )
    expect(
      document.querySelector('.pf-confirm-text'),
    ).toHaveTextContent('Te hemos enviado un email para confirmar.')
    expect(h.endpoints.suscribirNewsletter).toHaveBeenCalledWith('diego@correo.com')
  })

  it('éxito sin message del backend → cae a okDefault', async () => {
    h.endpoints.suscribirNewsletter.mockResolvedValue({})
    render(<NewsletterForm />)
    fireEvent.change(getEmail(), { target: { value: 'diego@correo.com' } })
    submit()
    await waitFor(() =>
      expect(
        document.querySelector('.pf-confirm-text'),
      ).toHaveTextContent('newsletter.okDefault'),
    )
  })

  it('error de red → muestra el mensaje del ApiError + botón reintentar', async () => {
    h.endpoints.suscribirNewsletter.mockRejectedValue(
      new h.ApiError('Sin conexión con la estafeta', 0),
    )
    render(<NewsletterForm />)
    fireEvent.change(getEmail(), { target: { value: 'diego@correo.com' } })
    submit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión con la estafeta'),
    )
    expect(
      screen.getByRole('button', { name: 'newsletter.reintentarRed' }),
    ).toBeInTheDocument()
  })

  it('error de red → clic en reintentar reenvía y transiciona a la confirmación', async () => {
    h.endpoints.suscribirNewsletter
      .mockRejectedValueOnce(new h.ApiError('Sin conexión con la estafeta', 0))
      .mockResolvedValueOnce({ message: 'Te hemos enviado un email para confirmar.' })
    render(<NewsletterForm />)
    fireEvent.change(getEmail(), { target: { value: 'diego@correo.com' } })
    submit()
    const retry = await screen.findByRole('button', { name: 'newsletter.reintentarRed' })
    fireEvent.click(retry)
    await waitFor(() =>
      expect(document.querySelector('.pf-confirm-text')).toHaveTextContent(
        'Te hemos enviado un email para confirmar.',
      ),
    )
    // El closure de email se relee, inFlightRef se resetea tras el fallo (si no,
    // el guard de doble-submit bloquearía el reintento) y se llama 2 veces.
    expect(h.endpoints.suscribirNewsletter).toHaveBeenCalledTimes(2)
    expect(h.endpoints.suscribirNewsletter).toHaveBeenNthCalledWith(2, 'diego@correo.com')
  })

  it('tras confirmar, "suscribir otro email" vuelve al formulario', async () => {
    h.endpoints.suscribirNewsletter.mockResolvedValue({
      message: 'Te hemos enviado un email para confirmar.',
    })
    render(<NewsletterForm />)
    fireEvent.change(getEmail(), { target: { value: 'diego@correo.com' } })
    submit()
    const reset = await screen.findByRole('button', { name: 'newsletter.reintentar' })
    fireEvent.click(reset)
    // Vuelve a 'idle': reaparece el campo email vacío y el botón suscribir.
    expect(getEmail()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'newsletter.submit' })).toBeInTheDocument()
  })
})
