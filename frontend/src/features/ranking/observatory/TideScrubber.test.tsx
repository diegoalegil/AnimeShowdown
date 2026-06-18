import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TideScrubber from './TideScrubber'

afterEach(cleanup)

describe('TideScrubber', () => {
  it('sin serie temporal: nota honesta y ningún control', () => {
    render(<TideScrubber dias={1} valor={0} onCambio={() => {}} habilitado={false} />)
    expect(screen.getByText(/Sin histórico de movimientos/i)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('con serie: slider 0..dias-1 y valor controlado', () => {
    render(<TideScrubber dias={7} valor={6} onCambio={() => {}} />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('6')
    expect(slider.value).toBe('6')
    // hoy = último índice
    expect(slider.getAttribute('aria-valuetext')).toBe('hoy')
  })

  it('emite onCambio con el día (número) al mover', () => {
    const onCambio = vi.fn()
    render(<TideScrubber dias={7} valor={6} onCambio={onCambio} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } })
    expect(onCambio).toHaveBeenCalledWith(3)
  })

  it('etiqueta los días anteriores como "-N d"', () => {
    render(<TideScrubber dias={7} valor={4} onCambio={() => {}} />)
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('-2 d')
  })

  it('anuncia el resumen del día por aria-live', () => {
    render(
      <TideScrubber dias={7} valor={3} onCambio={() => {}} resumen="día -3: Levi sube a 5º" />,
    )
    const live = screen.getByText('día -3: Levi sube a 5º')
    expect(live).toHaveAttribute('aria-live', 'polite')
  })
})
