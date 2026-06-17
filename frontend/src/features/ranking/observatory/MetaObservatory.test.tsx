import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MetaObservatory from './MetaObservatory'

afterEach(cleanup)

const RANKING = [
  { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball', elo: 2900, posicion: 1 },
  { slug: 'naruto', nombre: 'Naruto', anime: 'Naruto', elo: 2800, posicion: 2 },
  { slug: 'vegeta', nombre: 'Vegeta', anime: 'Dragon Ball', elo: 2700, posicion: 3 },
  { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece', elo: 2600, posicion: 4 },
  { slug: 'sasuke', nombre: 'Sasuke', anime: 'Naruto', elo: 2500, posicion: 5 },
]
const MOVIMIENTOS = [
  { slug: 'goku', posicionesPorDia: [2, 2, 1, 1, 1, 1, 1] },
  { slug: 'vegeta', posicionesPorDia: [1, 1, 3, 3, 3, 3, 3] },
  { slug: 'naruto', posicionesPorDia: [3, 3, 2, 2, 2, 2, 2] },
  { slug: 'luffy', posicionesPorDia: [5, 5, 4, 4, 4, 4, 4] },
  { slug: 'sasuke', posicionesPorDia: [4, 4, 5, 5, 5, 5, 5] },
]
const href = (slug: string) => `/personaje/${slug}`

describe('MetaObservatory', () => {
  it('pinta el cielo: cabecera, lienzo role=application y una estrella-enlace por personaje', () => {
    render(<MetaObservatory ranking={RANKING} hrefPersonaje={href} fecha="17 jun 2026" />)
    expect(screen.getByRole('heading', { name: 'El observatorio del meta' })).toBeInTheDocument()
    expect(screen.getByText('17 jun 2026')).toBeInTheDocument()
    expect(screen.getByRole('application')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(RANKING.length)
  })

  it('la leyenda da una constelación por anime y al pulsar atenúa las demás', () => {
    const { container } = render(<MetaObservatory ranking={RANKING} hrefPersonaje={href} />)
    const chip = screen.getByRole('button', { name: 'Dragon Ball' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    // 5 estrellas, 2 son de Dragon Ball ⇒ 3 atenuadas
    expect(container.querySelectorAll('.sky-star--atenuada')).toHaveLength(3)
  })

  it('«Volver a la tabla» invoca el callback', () => {
    const onVolver = vi.fn()
    render(<MetaObservatory ranking={RANKING} hrefPersonaje={href} onVolverTabla={onVolver} />)
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la tabla' }))
    expect(onVolver).toHaveBeenCalledOnce()
  })

  it('el botón de zoom alterna su estado', () => {
    render(<MetaObservatory ranking={RANKING} hrefPersonaje={href} />)
    const zoom = screen.getByRole('button', { name: 'Acercar' })
    expect(zoom).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(zoom)
    expect(screen.getByRole('button', { name: 'Alejar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sin serie temporal: el escrutador queda deshabilitado con nota honesta', () => {
    render(<MetaObservatory ranking={RANKING} hrefPersonaje={href} />)
    expect(screen.getByText(/Sin histórico de movimientos/i)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('con serie: hay escrutador y mover el día publica el resumen por aria-live', () => {
    render(<MetaObservatory ranking={RANKING} movimientos={MOVIMIENTOS} hrefPersonaje={href} />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.max).toBe('6')
    // hoy (día 6) no anuncia movimiento
    fireEvent.change(slider, { target: { value: '0' } })
    // día -6: el mayor movimiento del periodo es Vegeta (1º aquel día)
    expect(screen.getByText(/Vegeta/)).toBeInTheDocument()
  })

  it('marca la estrella propia del usuario', () => {
    const { container } = render(
      <MetaObservatory ranking={RANKING} hrefPersonaje={href} slugDestacado="goku" />,
    )
    expect(container.querySelectorAll('.sky-star--tu')).toHaveLength(1)
  })
})
