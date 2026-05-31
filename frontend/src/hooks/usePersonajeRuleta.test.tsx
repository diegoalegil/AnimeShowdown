import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ROULETTE_LAST_SLUG_STORAGE,
  getPersonajeSlugFromPath,
  usePersonajeRuleta,
} from './usePersonajeRuleta'
import { endpoints } from '../lib/api'

vi.mock('../lib/api', () => ({
  endpoints: {
    personajeAleatorio: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

function Harness() {
  const location = useLocation()
  const { girarRuleta, isLoading } = usePersonajeRuleta()
  return (
    <>
      <button type="button" onClick={() => girarRuleta()}>
        {isLoading ? 'Girando' : 'Ruleta'}
      </button>
      <span data-testid="path">{location.pathname}</span>
    </>
  )
}

function renderHarness(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Harness />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(endpoints.personajeAleatorio).mockReset()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('usePersonajeRuleta', () => {
  it('extrae el slug cuando la ruta actual es una ficha', () => {
    expect(getPersonajeSlugFromPath('/personajes/monkey-d-luffy')).toBe('monkey-d-luffy')
    expect(getPersonajeSlugFromPath('/ranking')).toBeNull()
  })

  it('excluye la ficha actual y navega al personaje aleatorio', async () => {
    vi.mocked(endpoints.personajeAleatorio).mockResolvedValue({ slug: 'zoro' })
    renderHarness('/personajes/luffy')

    fireEvent.click(screen.getByRole('button', { name: 'Ruleta' }))

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/personajes/zoro')
    })
    expect(endpoints.personajeAleatorio).toHaveBeenCalledWith({ exclude: 'luffy' })
    expect(sessionStorage.getItem(ROULETTE_LAST_SLUG_STORAGE)).toBe('zoro')
  })

  it('excluye el ultimo resultado cuando no esta en una ficha', async () => {
    sessionStorage.setItem(ROULETTE_LAST_SLUG_STORAGE, 'naruto')
    vi.mocked(endpoints.personajeAleatorio).mockResolvedValue({ slug: 'sakura' })
    renderHarness('/')

    fireEvent.click(screen.getByRole('button', { name: 'Ruleta' }))

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/personajes/sakura')
    })
    expect(endpoints.personajeAleatorio).toHaveBeenCalledWith({ exclude: 'naruto' })
  })
})
