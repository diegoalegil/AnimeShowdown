import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({
  personajes: [] as Array<{ slug: string; nombre: string }>,
}))

vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({ personajes: h.personajes }),
}))

import LostPath from './LostPath'
import { OPEN_COMMAND_PALETTE_EVENT } from '../components/CommandPaletteLazyMount'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LostPath />
    </MemoryRouter>,
  )
}

describe('LostPath (404)', () => {
  afterEach(() => {
    cleanup()
    h.personajes = []
  })

  it('expone el h1 real y las dos salidas (inicio + buscador)', () => {
    renderAt('/ruta-fantasma')
    expect(
      screen.getByRole('heading', { level: 1, name: /Página no encontrada/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver al inicio/i })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('button', { name: /Buscar/i })).toBeInTheDocument()
  })

  it('el botón buscador abre la paleta de mando (dispatch del evento)', () => {
    const onOpen = vi.fn()
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    try {
      renderAt('/ruta-fantasma')
      fireEvent.click(screen.getByRole('button', { name: /Buscar/i }))
      expect(onOpen).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    }
  })

  it('sugiere el personaje más cercano ante un slug mal escrito', () => {
    h.personajes = [
      { slug: 'naruto-uzumaki', nombre: 'Naruto Uzumaki' },
      { slug: 'goku', nombre: 'Goku' },
    ]
    renderAt('/personajes/naruto-uzamaki')
    const sug = screen.getByRole('link', { name: /Naruto Uzumaki/i })
    expect(sug).toHaveAttribute('href', '/personajes/naruto-uzumaki')
  })

  it('no muestra sugerencia en un 404 genérico (fuera de /personajes)', () => {
    h.personajes = [{ slug: 'goku', nombre: 'Goku' }]
    renderAt('/algo/inexistente')
    expect(screen.queryByText(/Quizás buscabas/i)).not.toBeInTheDocument()
  })
})
