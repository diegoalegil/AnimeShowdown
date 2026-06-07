import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CardBio from './CardBio'

const h = vi.hoisted(() => ({
  changeBio: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ changeBio: h.changeBio }),
}))

describe('CardBio', () => {
  afterEach(() => {
    cleanup()
    h.changeBio.mockReset()
    h.toast.success.mockReset()
    h.toast.error.mockReset()
  })

  it('rebasa el draft cuando cambia la bio fuente del usuario', () => {
    const user = { username: 'yor', bio: 'Bio original' }
    const { rerender } = render(<CardBio user={user} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('Bio original')

    fireEvent.change(textarea, { target: { value: 'Draft local sin guardar' } })
    expect(textarea).toHaveValue('Draft local sin guardar')

    rerender(<CardBio user={{ ...user, bio: 'Bio remota actualizada' }} />)

    expect(screen.getByRole('textbox')).toHaveValue('Bio remota actualizada')
    expect(screen.getByRole('button', { name: 'Guardar bio' })).toBeDisabled()
  })
})
