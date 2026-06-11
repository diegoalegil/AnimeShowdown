import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import TiltCard from './TiltCard'

function stubMatchMedia({ reduce, fine }: { reduce: boolean; fine: boolean }) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : fine,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function stubRaf() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TiltCard', () => {
  it('renderiza los hijos con la capa foil decorativa por rareza', () => {
    stubMatchMedia({ reduce: false, fine: true })
    const { container } = render(
      <TiltCard foil="especial">
        <span>carta</span>
      </TiltCard>,
    )

    expect(screen.getByText('carta')).toBeInTheDocument()
    const foil = container.querySelector('.as-card-foil')
    expect(foil).toHaveAttribute('aria-hidden', 'true')
    expect(foil).toHaveClass('as-card-foil--especial')
    expect(container.querySelectorAll('.as-card-foil__sparkle')).toHaveLength(4)
  })

  it('las SSR llevan lámina dorada y ningún sparkle', () => {
    stubMatchMedia({ reduce: false, fine: true })
    const { container } = render(
      <TiltCard>
        <span>carta</span>
      </TiltCard>,
    )

    expect(container.querySelector('.as-card-foil')).toHaveClass('as-card-foil--ssr')
    expect(container.querySelectorAll('.as-card-foil__sparkle')).toHaveLength(0)
  })

  it('activa el tilt al mover el puntero y vuelve al reposo al salir', () => {
    stubMatchMedia({ reduce: false, fine: true })
    stubRaf()
    const { container } = render(
      <TiltCard>
        <span>carta</span>
      </TiltCard>,
    )
    const root = container.firstElementChild as HTMLElement

    fireEvent.pointerMove(root, { clientX: 10, clientY: 10 })
    expect(root.style.getPropertyValue('--active')).toBe('1')
    expect(root.classList.contains('is-active')).toBe(true)

    fireEvent.pointerLeave(root)
    expect(root.style.getPropertyValue('--active')).toBe('0')
    expect(root.style.getPropertyValue('--mx')).toBe('0.5')
    expect(root.classList.contains('is-active')).toBe(false)
  })

  it('queda inerte con prefers-reduced-motion', () => {
    stubMatchMedia({ reduce: true, fine: true })
    stubRaf()
    const { container } = render(
      <TiltCard>
        <span>carta</span>
      </TiltCard>,
    )
    const root = container.firstElementChild as HTMLElement

    fireEvent.pointerMove(root, { clientX: 10, clientY: 10 })
    expect(root.style.getPropertyValue('--active')).toBe('0')
    expect(root.classList.contains('is-active')).toBe(false)
  })

  it('en táctil marca la presión sin inclinar', () => {
    stubMatchMedia({ reduce: false, fine: false })
    const { container } = render(
      <TiltCard>
        <span>carta</span>
      </TiltCard>,
    )
    const root = container.firstElementChild as HTMLElement

    fireEvent.pointerDown(root)
    expect(root.classList.contains('is-pressed')).toBe(true)
    expect(root.style.getPropertyValue('--active')).toBe('1')

    fireEvent.pointerUp(root)
    expect(root.classList.contains('is-pressed')).toBe(false)
    expect(root.style.getPropertyValue('--active')).toBe('0')
  })
})
