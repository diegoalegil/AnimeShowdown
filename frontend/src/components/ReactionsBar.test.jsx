import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Refs mutables disponibles dentro de las factories hoisted de vi.mock.
const h = vi.hoisted(() => ({
  user: { current: { id: 1, username: 'goku' } },
  data: {
    current: {
      miReaccion: 'FIRE',
      counts: { FIRE: 5, HEART: 2, LAUGH: 0, CRY: 1 },
      total: 8,
    },
  },
  mutate: vi.fn(),
  play: vi.fn(),
  navigate: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: h.toast }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
}))

vi.mock('framer-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: h.user.current }),
}))

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: h.play }),
}))

vi.mock('../hooks/useReacciones', () => ({
  useReacciones: () => ({ data: h.data.current, isLoading: false }),
  useAplicarReaccion: () => ({ mutate: h.mutate, isPending: false }),
}))

import ReactionsBar from './ReactionsBar'

describe('ReactionsBar — abanicos uchiwa', () => {
  beforeEach(() => {
    h.user.current = { id: 1, username: 'goku' }
    h.data.current = {
      miReaccion: 'FIRE',
      counts: { FIRE: 5, HEART: 2, LAUGH: 0, CRY: 1 },
      total: 8,
    }
    h.mutate.mockReset()
    h.play.mockReset()
    h.navigate.mockReset()
    h.toast.mockReset()
    h.toast.error.mockReset()
  })

  afterEach(() => cleanup())

  it('renderiza los 4 abanicos (uno por reacción) con sus kanji', () => {
    const { container } = render(
      <ReactionsBar targetType="PERSONAJE" targetId={1} />,
    )
    const botones = container.querySelectorAll('.fanr__btn')
    expect(botones).toHaveLength(4)
    const kanji = [...container.querySelectorAll('.fanr__closedFace')].map(
      (n) => n.textContent,
    )
    expect(kanji).toEqual(['熱', '好', '笑', '涙'])
  })

  it('marca aria-pressed solo en el abanico activo (miReaccion del hook)', () => {
    render(<ReactionsBar targetType="PERSONAJE" targetId={1} />)
    const fuego = screen.getByRole('button', { name: /Fuego/i })
    expect(fuego).toHaveAttribute('aria-pressed', 'true')
    const meEncanta = screen.getByRole('button', { name: /Me encanta/i })
    expect(meEncanta).toHaveAttribute('aria-pressed', 'false')
  })

  it('usa el conteo del hook TAL CUAL (sin sumar +1 local)', () => {
    render(<ReactionsBar targetType="PERSONAJE" targetId={1} />)
    // FIRE es la activa y el hook ya incluye al usuario en counts: debe
    // mostrar 5, no 6.
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('al tocar un abanico llama a la mutación con el tipo y reproduce sonido', () => {
    render(<ReactionsBar targetType="PERSONAJE" targetId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /Me encanta/i }))
    expect(h.mutate).toHaveBeenCalledTimes(1)
    expect(h.mutate.mock.calls[0][0]).toBe('HEART')
    expect(h.play).toHaveBeenCalledWith('playVote')
  })

  it('invitado: no muta, muestra toast con CTA y no reproduce playVote', () => {
    h.user.current = null
    render(<ReactionsBar targetType="PERSONAJE" targetId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /Fuego/i }))
    expect(h.mutate).not.toHaveBeenCalled()
    expect(h.toast).toHaveBeenCalledTimes(1)
    expect(h.play).toHaveBeenCalledWith('playClick')
  })

  it('marca al líder (mayor conteo único) con la clase de laca oro', () => {
    const { container } = render(
      <ReactionsBar targetType="PERSONAJE" targetId={1} />,
    )
    // FIRE=5 es el máximo único → su botón lleva --leader.
    const fuego = screen.getByRole('button', { name: /Fuego/i })
    expect(fuego.classList.contains('fanr__btn--leader')).toBe(true)
    const leaders = container.querySelectorAll('.fanr__btn--leader')
    expect(leaders).toHaveLength(1)
  })
})
