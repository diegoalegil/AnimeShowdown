import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PersonajeCard from './PersonajeCard'

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
}))

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('hover: hover') || query.includes('pointer: fine'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('PersonajeCard', () => {
  it('mantiene estable el nodo de la carta al hacer hover', () => {
    const { container } = render(
      <MemoryRouter>
        <PersonajeCard
          slug="naruto-uzumaki"
          nombre="Naruto Uzumaki"
          anime="Naruto"
          rank={1}
        />
      </MemoryRouter>,
    )

    const link = container.querySelector('a[href="/personajes/naruto-uzumaki"]')
    const articleBefore = link?.querySelector('article')

    expect(link).not.toBeNull()
    expect(articleBefore).not.toBeNull()

    fireEvent.mouseEnter(link as Element)

    expect(
      container.querySelector('a[href="/personajes/naruto-uzumaki"] article'),
    ).toBe(articleBefore)
  })
})
