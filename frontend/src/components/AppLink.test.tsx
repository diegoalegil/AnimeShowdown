import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AppLink, AppNavLink } from './AppLink'
import {
  PERSONAJE_HERO_VT,
  markPersonajeHero,
  releasePersonajeHero,
  settleNavigationViewTransition,
} from '../lib/viewTransitions'

// startViewTransition real acepta callback suelto o { update, types } (la forma
// objeto la usan las navegaciones del intermedio). Los fakes extraen el update.
type VTArg = (() => Promise<void>) | { update: () => Promise<void>; types?: string[] }
const vtUpdate = (arg: VTArg) => (typeof arg === 'function' ? arg : arg.update)

const doc = document as unknown as {
  startViewTransition?: (arg: VTArg) => {
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
    const startViewTransition = vi.fn((arg: VTArg) => {
      vtUpdate(arg)()
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

  it('ejecuta el onClick del consumidor antes de transicionar', () => {
    const llamadas: string[] = []
    doc.startViewTransition = vi.fn((arg: VTArg) => {
      llamadas.push('transition')
      vtUpdate(arg)()
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

  it('invoca onViewTransitionStart tras los guards, justo antes de transicionar', () => {
    const llamadas: string[] = []
    doc.startViewTransition = vi.fn((arg: VTArg) => {
      llamadas.push('transition')
      vtUpdate(arg)()
      return { ready: Promise.resolve(), finished: Promise.resolve() }
    })

    renderConRutas(
      <AppLink
        to="/personajes"
        onClick={() => llamadas.push('onClick')}
        onViewTransitionStart={() => llamadas.push('marca')}
      >
        ir
      </AppLink>,
    )
    fireEvent.click(screen.getByText('ir'))

    expect(llamadas).toEqual(['onClick', 'marca', 'transition'])
  })

  it('un cmd+click no deja marca residual del morph', () => {
    const startViewTransition = vi.fn(() => ({
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    }))
    doc.startViewTransition = startViewTransition

    const carta = document.createElement('article')
    document.body.appendChild(carta)
    try {
      renderConRutas(
        <AppLink to="/personajes" onViewTransitionStart={() => markPersonajeHero(carta)}>
          ir
        </AppLink>,
      )
      fireEvent.click(screen.getByText('ir'), { metaKey: true })

      expect(startViewTransition).not.toHaveBeenCalled()
      expect(carta.style.getPropertyValue('view-transition-name')).toBe('')

      // El mismo link, en un click normal, sí marca el origen del morph.
      // (El cmd+click dejó que happy-dom navegara el <a>; se restaura la
      // location para que el guard por pathname no corte el segundo click.)
      window.history.replaceState(null, '', '/')
      fireEvent.click(screen.getByText('ir'))
      expect(carta.style.getPropertyValue('view-transition-name')).toBe(PERSONAJE_HERO_VT)
    } finally {
      releasePersonajeHero(carta)
      carta.remove()
    }
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
