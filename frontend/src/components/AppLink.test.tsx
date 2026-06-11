import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AppLink, AppNavLink } from './AppLink'
import { settleNavigationViewTransition } from '../lib/viewTransitions'

const doc = document as unknown as {
  startViewTransition?: (cb: () => Promise<void>) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

function renderConRutas(link: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={link} />
        <Route path="/personajes" element={<p>destino personajes</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  settleNavigationViewTransition()
  delete doc.startViewTransition
  cleanup()
  // El click modificado deja que happy-dom ejecute la navegación default del
  // <a> y cambia window.location; se restaura para no contaminar el guard
  // por pathname de los tests siguientes.
  window.history.replaceState(null, '', '/')
})

describe('AppLink', () => {
  it('sin soporte de view transitions navega como un Link normal', () => {
    renderConRutas(<AppLink to="/personajes">ir</AppLink>)
    fireEvent.click(screen.getByText('ir'))
    expect(screen.getByText('destino personajes')).toBeInTheDocument()
  })

  it('con soporte envuelve la navegación en startViewTransition', () => {
    const startViewTransition = vi.fn((cb: () => Promise<void>) => {
      cb()
      return { ready: Promise.resolve(), finished: Promise.resolve() }
    })
    doc.startViewTransition = startViewTransition

    renderConRutas(<AppLink to="/personajes">ir</AppLink>)
    fireEvent.click(screen.getByText('ir'))

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByText('destino personajes')).toBeInTheDocument()
  })

  it('respeta clicks modificados (cmd/ctrl): ni transición ni preventDefault', () => {
    const startViewTransition = vi.fn(() => ({
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    }))
    doc.startViewTransition = startViewTransition

    renderConRutas(<AppLink to="/personajes">ir</AppLink>)
    fireEvent.click(screen.getByText('ir'), { metaKey: true })

    expect(startViewTransition).not.toHaveBeenCalled()
  })

  it('ejecuta el onClick del consumidor antes de transicionar (marca del morph)', () => {
    const llamadas: string[] = []
    doc.startViewTransition = vi.fn((cb: () => Promise<void>) => {
      llamadas.push('transition')
      cb()
      return { ready: Promise.resolve(), finished: Promise.resolve() }
    })

    renderConRutas(
      <AppLink to="/personajes" onClick={() => llamadas.push('onClick')}>
        ir
      </AppLink>,
    )
    fireEvent.click(screen.getByText('ir'))

    expect(llamadas).toEqual(['onClick', 'transition'])
  })

  it('AppNavLink conserva el className funcional de NavLink', () => {
    renderConRutas(
      <AppNavLink to="/" end className={({ isActive }) => (isActive ? 'activo' : 'inactivo')}>
        inicio
      </AppNavLink>,
    )
    expect(screen.getByText('inicio').className).toBe('activo')
  })
})
