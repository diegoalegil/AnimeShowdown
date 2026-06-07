import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CardReferral from './CardReferral'

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/usePerfil', () => ({
  usePerfilReferral: () => ({
    isLoading: false,
    data: {
      codigo: 'NERV2026',
      invitadosVerificados: 1,
      umbralReclutador: 3,
      reclutadorDesbloqueado: false,
    },
  }),
}))

describe('CardReferral', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    h.toast.success.mockReset()
    h.toast.error.mockReset()
  })

  it('limpia el timer de feedback al desmontarse despues de copiar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    const { unmount } = render(<CardReferral />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar enlace/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://localhost:3000/register?ref=NERV2026'))
    unmount()

    expect(clearSpy).toHaveBeenCalled()
  })
})
