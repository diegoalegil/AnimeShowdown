import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import ScribeField from './ScribeField'

afterEach(() => cleanup())

const noop = () => {}

// jsdom no acepta modifierCapsLock en el init del KeyboardEvent: se stubea
// getModifierState sobre el evento nativo (React delega en él).
function eventoConCapsLock() {
  const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true })
  Object.defineProperty(ev, 'getModifierState', { value: () => true })
  return ev
}

describe('ScribeField', () => {
  it('asocia la label flotante al control nativo (htmlFor)', () => {
    render(<ScribeField label="Nombre" value="" onChange={noop} />)
    const input = screen.getByLabelText('Nombre')
    expect(input.tagName).toBe('INPUT')
    // placeholder=" " es obligatorio para el float CSS por :placeholder-shown
    expect(input).toHaveAttribute('placeholder', ' ')
  })

  it('pinta el error con aria-invalid + aria-describedby y lo anuncia en la zona viva', () => {
    render(<ScribeField label="Email" value="x" onChange={noop} error="El email no es válido" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const msg = screen.getByText('El email no es válido')
    expect(msg).toHaveClass('scribe-msg')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)).toContainElement(msg)
  })

  it('muestra el check de corrección en el flanco error→null', () => {
    const { rerender, container } = render(
      <ScribeField label="Usuario" value="ok" onChange={noop} error="Mínimo 3 caracteres" />,
    )
    expect(container.querySelector('.scribe-check')).toBeNull()
    rerender(<ScribeField label="Usuario" value="okey" onChange={noop} error={null} />)
    expect(container.querySelector('.scribe-check')).not.toBeNull()
  })

  it('avisa de Bloq Mayús SOLO en password y lo limpia al blur', () => {
    render(<ScribeField label="Contraseña" value="" onChange={noop} type="password" />)
    const input = screen.getByLabelText('Contraseña')
    fireEvent(input, eventoConCapsLock())
    expect(screen.getByText('Bloq Mayús activado')).toBeInTheDocument()
    fireEvent.blur(input)
    expect(screen.queryByText('Bloq Mayús activado')).toBeNull()
  })

  it('no avisa de Bloq Mayús en campos de texto', () => {
    render(<ScribeField label="Alias" value="" onChange={noop} />)
    fireEvent(screen.getByLabelText('Alias'), eventoConCapsLock())
    expect(screen.queryByText('Bloq Mayús activado')).toBeNull()
  })

  it('el contador pasa a aviso al 90% del límite y a tope al 100%', () => {
    const { rerender } = render(
      <ScribeField label="Nombre" value={'x'.repeat(72)} onChange={noop} maxLength={80} showCount />,
    )
    expect(screen.getByText('72 / 80')).toHaveClass('is-warn')
    rerender(
      <ScribeField label="Nombre" value={'x'.repeat(80)} onChange={noop} maxLength={80} showCount />,
    )
    expect(screen.getByText('80 / 80')).toHaveClass('is-max')
  })

  it('el ojo revela y vuelve a ocultar la contraseña', () => {
    render(<ScribeField label="Contraseña" value="secreta1" onChange={noop} type="password" />)
    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
