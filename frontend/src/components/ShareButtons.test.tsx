import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShareButtons from './ShareButtons'

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))

describe('ShareButtons', () => {
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
    const { unmount } = render(<ShareButtons url="https://anime.test/ranking" texto="Top anime" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://anime.test/ranking'))
    unmount()

    expect(clearSpy).toHaveBeenCalled()
  })
})
