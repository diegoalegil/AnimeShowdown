import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AccessibleDialog from './AccessibleDialog'

/* jsdom no trae matchMedia: lo stubeamos. `reduce` controla la rama
   prefers-reduced-motion (fade plano, desmonte casi inmediato); `sheet`
   controla el viewport móvil (max-width: 639px). */
function stubMatchMedia({ reduce = false, sheet = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion')
      ? reduce
      : query.includes('max-width')
        ? sheet
        : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/* Harness: un #root (lo que AccessibleDialog inertiza) con un botón trigger
   que abre el diálogo. El diálogo lleva un botón focusable dentro. */
function Harness({
  initialOpen = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: {
  initialOpen?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <div id="root">
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <AccessibleDialog
        open={open}
        onClose={() => setOpen(false)}
        titleId="dlg-title"
        closeOnBackdrop={closeOnBackdrop}
        closeOnEscape={closeOnEscape}
      >
        <h2 id="dlg-title">Título</h2>
        <button type="button">Acción interna</button>
        <button type="button">Otra acción</button>
      </AccessibleDialog>
    </div>
  )
}

describe('AccessibleDialog (piel shōji — contrato a11y)', () => {
  beforeEach(() => {
    stubMatchMedia()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('al abrir expone role=dialog + aria-modal + aria-labelledby y mueve el foco dentro', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'dlg-title')

    const accion = screen.getByRole('button', { name: 'Acción interna' })
    expect(dialog).toContainElement(accion)
    expect(document.activeElement).toBe(accion)
  })

  it('inertiza #root mientras abierto y lo restaura al cerrar (limpieza a11y inmediata)', () => {
    vi.useFakeTimers()
    render(<Harness initialOpen />)
    const appRoot = document.getElementById('root') as HTMLElement

    expect(appRoot.inert).toBe(true)
    expect(appRoot.getAttribute('aria-hidden')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')

    // Cierre: la limpieza a11y debe correr de inmediato (fondo usable ya),
    // sin esperar a la fase de cierre visual.
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(appRoot.inert).toBe(false)
    expect(appRoot.getAttribute('aria-hidden')).toBe(null)
    expect(document.body.style.overflow).toBe('')

    // El diálogo aún está montado durante la fase de cierre, pero ya inerte.
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveAttribute('aria-hidden', 'true')

    // Tras la fase de cierre (~300ms) el diálogo DEBE desmontar del todo.
    act(() => {
      vi.advanceTimersByTime(320)
    })
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
    // Sin #root inert colgado tras el desmonte.
    expect(appRoot.inert).toBe(false)
    expect(appRoot.getAttribute('aria-hidden')).toBe(null)
  })

  it('Escape llama onClose y devuelve el foco al trigger', () => {
    vi.useFakeTimers()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    // El usuario de teclado tiene el foco en el trigger al activarlo; así
    // AccessibleDialog lo guarda como "trigger" para restaurarlo al cerrar.
    act(() => {
      trigger.focus()
      fireEvent.click(trigger)
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    // El restore de foco usa setTimeout(0) tras el unmount del efecto.
    act(() => {
      vi.advanceTimersByTime(320)
    })
    expect(document.activeElement).toBe(trigger)
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('click en el backdrop llama onClose; click dentro del panel no', () => {
    render(<Harness initialOpen />)
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement as HTMLElement

    // Click dentro del panel: NO cierra.
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click en el backdrop (target === currentTarget): cierra.
    fireEvent.click(backdrop)
    expect(dialog).toHaveAttribute('aria-hidden', 'true')
  })

  it('respeta closeOnEscape=false y closeOnBackdrop=false', () => {
    render(<Harness initialOpen closeOnEscape={false} closeOnBackdrop={false} />)
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement as HTMLElement

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(backdrop)
    // Sigue abierto y activo (sin marca de cierre).
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-hidden')
  })

  it('las hojas y el filo del marco son decorativos (aria-hidden)', () => {
    const { container } = render(<Harness initialOpen />)
    const leaves = container.ownerDocument.querySelector('.as-shoji-leaves')
    expect(leaves).not.toBeNull()
    expect(leaves).toHaveAttribute('aria-hidden', 'true')
    // Las hojas viven FUERA del foco: no son focusables.
    expect(leaves?.querySelector('button')).toBeNull()
  })

  it('con prefers-reduced-motion no rompe: abre, cierra y desmonta', () => {
    stubMatchMedia({ reduce: true })
    vi.useFakeTimers()
    render(<Harness initialOpen />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    // closeMs = 0 con reduced-motion → desmonte casi inmediato.
    act(() => {
      vi.advanceTimersByTime(10)
    })
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('atrapa Tab: desde el último → primero y Shift+Tab desde el primero → último', () => {
    render(<Harness initialOpen />)
    const dialog = screen.getByRole('dialog')
    const focusables = Array.from(
      dialog.querySelectorAll('button:not([disabled])'),
    ) as HTMLElement[]
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    expect(first).not.toBe(last)

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('reabrir a mitad del cierre reactiva el diálogo (panel ya no inerte, #root re-inerte)', () => {
    vi.useFakeTimers()
    render(<Harness />)
    const appRoot = document.getElementById('root') as HTMLElement
    const reopen = screen.getByRole('button', { name: 'Abrir' })

    act(() => {
      fireEvent.click(reopen)
    })
    // Cerrar → fase 'closing' (a11y ya limpio, panel inerte, timer pendiente).
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    act(() => {
      vi.advanceTimersByTime(100) // avance PARCIAL: el cierre (300ms) sigue vivo
    })
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true')

    // Reabrir a mitad del cierre.
    act(() => {
      fireEvent.click(reopen)
    })
    const panel = screen.getByRole('dialog')
    expect(panel.getAttribute('aria-hidden')).toBe(null) // panel reactivado
    expect(panel.className).not.toContain('pointer-events-none')
    expect(appRoot.inert).toBe(true) // fondo re-inertizado

    // El timer VIEJO del cierre NO debe desmontar ni soltar el inert al vencer.
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(screen.getByRole('dialog').getAttribute('aria-hidden')).toBe(null)
    expect(appRoot.inert).toBe(true)
  })
})
