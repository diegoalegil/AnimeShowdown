import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from './useFocusTrap'

afterEach(cleanup)

function Overlay({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, { open, onClose })
  return (
    <div>
      <button type="button" data-testid="fuera">
        fondo
      </button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="prueba">
          <button type="button" data-testid="primero">
            uno
          </button>
          <button type="button" data-testid="ultimo">
            dos
          </button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('enfoca el primer focusable al abrir', () => {
    const { getByTestId } = render(<Overlay />)
    expect(document.activeElement).toBe(getByTestId('primero'))
  })

  it('Tab desde el último vuelve al primero (trap)', () => {
    const { getByTestId } = render(<Overlay />)
    getByTestId('ultimo').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(getByTestId('primero'))
  })

  it('Shift+Tab desde el primero salta al último (trap)', () => {
    const { getByTestId } = render(<Overlay />)
    getByTestId('primero').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(getByTestId('ultimo'))
  })

  it('Escape invoca onClose', () => {
    const onClose = vi.fn()
    render(<Overlay onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('bloquea el scroll del body mientras está abierto y lo restaura al cerrar', () => {
    document.body.style.overflow = 'scroll'
    const { rerender } = render(<Overlay open />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Overlay open={false} />)
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('no arma nada si open es false', () => {
    document.body.style.overflow = ''
    const onClose = vi.fn()
    render(<Overlay open={false} onClose={onClose} />)
    expect(document.body.style.overflow).toBe('')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
