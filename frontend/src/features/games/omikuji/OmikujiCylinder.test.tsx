import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// Conmutador de reduced-motion por test: el componente bifurca a un botón
// directo cuando el usuario pide menos movimiento.
const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>()
  return { ...mod, useReducedMotion: () => reduced.value }
})

vi.mock('../../../contexts/SoundContext', () => ({
  useSound: () => ({ muted: true }),
}))

import OmikujiCylinder from './OmikujiCylinder'

afterEach(() => cleanup())
beforeEach(() => {
  reduced.value = false
})

describe('OmikujiCylinder', () => {
  it('renderiza el cilindro operable con la instrucción en el aria-label', () => {
    render(<OmikujiCylinder fortuna="大吉" numero={7} onRevealed={() => {}} />)
    const btn = screen.getByRole('button', { name: /mantén pulsado/i })
    expect(btn).toHaveAttribute('tabindex', '0')
  })

  it('Enter arranca el ritual desde idle (operable por teclado)', () => {
    render(<OmikujiCylinder fortuna="大吉" numero={7} onRevealed={() => {}} />)
    const btn = screen.getByRole('button', { name: /mantén pulsado/i })
    expect(btn).toHaveStyle({ cursor: 'grab' })
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(btn).toHaveStyle({ cursor: 'grabbing' })
  })

  it('con reduced-motion ofrece el botón directo y entrega al revelado', () => {
    reduced.value = true
    const onRevealed = vi.fn()
    render(<OmikujiCylinder fortuna="大吉" numero={7} onRevealed={onRevealed} />)
    fireEvent.click(screen.getByRole('button', { name: /revelar la fortuna/i }))
    expect(onRevealed).toHaveBeenCalledTimes(1)
  })
})
