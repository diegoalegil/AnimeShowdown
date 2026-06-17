import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SkyStar from './SkyStar'

const STAR = {
  slug: 'goku',
  nombre: 'Goku',
  anime: 'Dragon Ball',
  elo: 2900,
  posicion: 1,
  x: 260,
  y: 310,
  tam: 46,
  brillo: 1,
  angulo: 0,
  cx: 260,
  cy: 310,
  constelacion: 'Dragon Ball',
  indiceConstelacion: 0,
  rangoEnAnime: 0,
} as const

describe('SkyStar', () => {
  it('es un enlace a la ficha con aria-label de ranking completo', () => {
    render(<SkyStar estrella={STAR} href="/personaje/goku" />)
    const link = screen.getByRole('link', {
      name: '1º: Goku, Dragon Ball, ELO 2900',
    })
    expect(link).toHaveAttribute('href', '/personaje/goku')
    expect(link).toHaveAttribute('data-slug', 'goku')
  })

  it('marca "tú" solo cuando es la estrella destacada del usuario', () => {
    const { rerender } = render(<SkyStar estrella={STAR} href="/personaje/goku" />)
    expect(screen.queryByText('tú')).toBeNull()
    rerender(<SkyStar estrella={STAR} href="/personaje/goku" destacada />)
    expect(screen.getByText('tú')).toBeInTheDocument()
  })

  it('proyecta posición y tamaño como custom props del transform', () => {
    const { container } = render(<SkyStar estrella={STAR} href="/x" retardoMs={180} />)
    const el = container.querySelector('.sky-star') as HTMLElement
    expect(el.style.getPropertyValue('--x')).toBe('260px')
    expect(el.style.getPropertyValue('--tam')).toBe('46px')
    expect(el.style.getPropertyValue('--delay')).toBe('180ms')
  })

  it('solo dibuja estela cuando hay origen de movimiento (scrub real)', () => {
    const { container, rerender } = render(<SkyStar estrella={STAR} href="/x" />)
    expect(container.querySelector('.sky-star__estela')).toBeNull()
    rerender(<SkyStar estrella={STAR} href="/x" estelaDesde={{ x: 200, y: 310 }} />)
    expect(container.querySelector('.sky-star__estela')).not.toBeNull()
  })
})
