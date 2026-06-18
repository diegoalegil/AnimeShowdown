import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HomeStreakEmber from './HomeStreakEmber'

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

  it('con racha guardada muestra el número y el copy de mantener', () => {
    localStorage.setItem(
      'animeshowdown.daily-streak.v1',
      JSON.stringify({ current: 5, lastCompletedDate: '2026-06-18' }),
    )
    renderEmber()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Mantén la llama encendida')).toBeInTheDocument()
  })
})
