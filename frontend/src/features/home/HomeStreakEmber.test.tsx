import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HomeStreakEmber from './HomeStreakEmber'
import { fechaDelDia } from '../../lib/games'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderEmber() {
  return render(
    <MemoryRouter>
      <HomeStreakEmber />
    </MemoryRouter>,
  )
}

describe('HomeStreakEmber', () => {
  it('enlaza a los retos diarios (/games)', () => {
    renderEmber()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/games')
  })

  it('sin racha (localStorage vacío) muestra estado aspiracional', () => {
    renderEmber()
    expect(screen.getByText('Enciende tu racha hoy')).toBeInTheDocument()
    expect(screen.getByText('sin racha')).toBeInTheDocument()
  })

  it('con racha viva (completada hoy) muestra el número y el copy de mantener', () => {
    localStorage.setItem(
      'animeshowdown.daily-streak.v1',
      JSON.stringify({ current: 5, lastCompletedDate: fechaDelDia() }),
    )
    renderEmber()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Mantén la llama encendida')).toBeInTheDocument()
  })

  it('racha caducada (último día completado anterior a ayer) cae a estado aspiracional', () => {
    // Regresión A3: antes mostraba "5 días" indefinidamente tras un día perdido.
    localStorage.setItem(
      'animeshowdown.daily-streak.v1',
      JSON.stringify({ current: 5, lastCompletedDate: '2000-01-01' }),
    )
    renderEmber()
    expect(screen.getByText('Enciende tu racha hoy')).toBeInTheDocument()
    expect(screen.getByText('sin racha')).toBeInTheDocument()
  })
})
