import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BrandSelect from './BrandSelect'

type Opt = { value: string; label: string }

const SHORT: Opt[] = [
  { value: '', label: 'Todos' },
  { value: 'a', label: 'Acción' },
  { value: 'b', label: 'Aventura' },
]

// > 8 opciones → searchable auto.
const LONG: Opt[] = Array.from({ length: 10 }, (_, i) => ({
  value: `v${i}`,
  label: `Opción ${i}`,
}))

function openPanel() {
  fireEvent.click(screen.getByRole('button'))
}

describe('BrandSelect (piel de escriba, cmdk preservado)', () => {
  afterEach(cleanup)

  it('pinta el trigger con el placeholder cuando no hay valor', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={[{ value: 'x', label: 'X' }]} placeholder="Elige…" />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveTextContent('Elige…')
    // a11y del trigger: combobox/listbox cerrado.
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('pinta el label de la opción seleccionada en el trigger', () => {
    render(<BrandSelect value="a" onChange={vi.fn()} options={SHORT} />)
    expect(screen.getByRole('button')).toHaveTextContent('Acción')
  })

  it('expone aria-label en el trigger (filtros sin label visible)', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={SHORT} ariaLabel="Filtrar por género" />)
    expect(screen.getByRole('button', { name: 'Filtrar por género' })).toBeInTheDocument()
  })

  it('abrir (click) muestra las opciones y marca aria-expanded', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={SHORT} />)
    openPanel()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('option', { name: 'Aventura' })).toBeInTheDocument()
  })

  it('elegir una opción llama a onChange(value) y cierra el panel', async () => {
    const onChange = vi.fn()
    render(<BrandSelect value="" onChange={onChange} options={SHORT} />)
    openPanel()
    fireEvent.click(screen.getByRole('option', { name: 'Aventura' }))
    expect(onChange).toHaveBeenCalledWith('b')
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument())
  })

  it('searchable auto: > 8 opciones muestra el input de búsqueda', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={LONG} ariaLabel="larga" />)
    openPanel()
    // No usamos toBeVisible(): happy-dom no carga el CSS, así que .sr-only no
    // oculta nada y toBeVisible() pasaría incluso con el input oculto. Asertamos
    // estructuralmente: el input vive en la caja visible, NO en sr-only.
    const input = screen.getByPlaceholderText('Buscar…')
    expect(input.closest('.sr-only')).toBeNull()
    expect(input.closest('.bs-scribe-search')).not.toBeNull()
  })

  it('searchable auto: ≤ 8 opciones oculta el input (sr-only), sin caja visible', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={SHORT} ariaLabel="corta" />)
    openPanel()
    const input = screen.getByPlaceholderText('Buscar…')
    // El input sigue en el DOM (cmdk conserva teclado), pero en contenedor sr-only.
    expect(input.closest('.sr-only')).not.toBeNull()
  })

  it('searchable=false fuerza el input oculto aunque la lista sea larga', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={LONG} searchable={false} />)
    openPanel()
    expect(screen.getByPlaceholderText('Buscar…').closest('.sr-only')).not.toBeNull()
  })

  it('escribir en el input filtra las opciones (type-to-search)', async () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={LONG} ariaLabel="larga" />)
    openPanel()
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'Opción 3' } })
    await waitFor(() => {
      const opts = screen.getAllByRole('option')
      expect(opts).toHaveLength(1)
      expect(opts[0]).toHaveTextContent('Opción 3')
    })
  })

  it('búsqueda sin coincidencias muestra el estado vacío', async () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={LONG} ariaLabel="larga" />)
    openPanel()
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'zzz-nada' } })
    await waitFor(() => expect(screen.getByText('Sin resultados.')).toBeInTheDocument())
  })

  it('Escape cierra el panel y devuelve el foco al trigger', async () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={SHORT} />)
    openPanel()
    expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument())
    expect(screen.getByRole('button')).toHaveFocus()
  })

  it('click fuera cierra el panel', async () => {
    render(
      <div>
        <BrandSelect value="" onChange={vi.fn()} options={SHORT} ariaLabel="filtro" />
        <button type="button">fuera</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'filtro' }))
    expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'fuera' }))
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument())
  })

  it('disabled: la guarda !disabled cierra el panel aunque estuviera abierto', () => {
    // El <button disabled> nativo ya traga el click, así que un test de "click
    // no abre" lo satisface el navegador, no el componente. Ejercitamos la
    // guarda real (panelOpen = open && !disabled): abrimos habilitado y, al
    // pasar a disabled con el mismo open interno, el panel DEBE desaparecer.
    const { rerender } = render(<BrandSelect value="" onChange={vi.fn()} options={SHORT} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument()

    rerender(<BrandSelect value="" onChange={vi.fn()} options={SHORT} disabled />)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('aria-controls del trigger resuelve al listbox real (id de cmdk)', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={SHORT} ariaLabel="filtro" />)
    openPanel()
    const id = screen.getByRole('button').getAttribute('aria-controls')
    expect(id).toBeTruthy()
    // El id debe apuntar al elemento listbox real (cmdk asigna su propio id).
    expect(document.getElementById(id as string)).toBe(screen.getByRole('listbox'))
  })

  it('al abrir, el input de búsqueda recibe el foco (autoFocus / type-ahead)', () => {
    render(<BrandSelect value="" onChange={vi.fn()} options={LONG} ariaLabel="larga" />)
    openPanel()
    expect(screen.getByPlaceholderText('Buscar…')).toHaveFocus()
  })

  it('navegación por teclado: ArrowDown + Enter selecciona y llama onChange', () => {
    const onChange = vi.fn()
    render(<BrandSelect value="" onChange={onChange} options={SHORT} ariaLabel="corta" />)
    openPanel()
    const input = screen.getByPlaceholderText('Buscar…')
    // cmdk auto-resalta el primer ítem ('' Todos); ArrowDown baja al 2º ('a').
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('marca la opción activa con el Check (selección actual)', () => {
    render(<BrandSelect value="a" onChange={vi.fn()} options={SHORT} />)
    openPanel()
    const activa = screen.getByRole('option', { name: 'Acción' })
    // El Check (lucide) marca la fila del valor actual; las demás no lo tienen.
    expect(activa.querySelector('.lucide-check')).not.toBeNull()
    const otra = screen.getByRole('option', { name: 'Aventura' })
    expect(otra.querySelector('.lucide-check')).toBeNull()
  })
})
