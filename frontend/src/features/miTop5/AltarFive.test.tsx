import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — componente .jsx sin tipos
import AltarFive from './AltarFive'

const play = vi.fn()
vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

afterEach(() => {
  cleanup()
  play.mockClear()
})

const ENTRIES = [
  { slug: 'luffy', name: 'Luffy' },
  { slug: 'zoro', name: 'Zoro' },
  { slug: 'naruto', name: 'Naruto' },
  null,
  null,
]

function renderAltar(props = {}) {
  return render(<AltarFive entries={ENTRIES} {...props} />)
}

describe('AltarFive', () => {
  it('pinta los 5 puestos como lista ordenada con sus numerales kanji', () => {
    const { container } = renderAltar()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0]).toHaveAccessibleName('Puesto 1: Luffy')
    expect(items[3]).toHaveAccessibleName('Puesto 4: vacío')
    expect(container.textContent).toContain('一')
    expect(container.textContent).toContain('五')
  })

  it('▼ baja al ocupante, devuelve el orden completo con meta y lo anuncia', () => {
    const onChange = vi.fn()
    const { container } = renderAltar({ onChange })

    fireEvent.click(
      screen.getByRole('button', { name: 'Bajar a Luffy al puesto 2' }),
    )

    expect(onChange).toHaveBeenCalledTimes(1)
    const [next, meta] = onChange.mock.calls[0]
    expect(next.map((e: { slug: string } | null) => e?.slug ?? null)).toEqual([
      'zoro',
      'luffy',
      'naruto',
      null,
      null,
    ])
    expect(meta).toEqual({ type: 'swap', from: 0, to: 1 })
    // El reorden por teclado anuncia el cambio relativo (no recita los 5).
    expect(container.querySelector('.af-sr')?.textContent).toContain(
      'Luffy al puesto 2',
    )
    // jsdom no implementa WAAPI: el ritual degrada a swap directo con golpe.
    expect(play).toHaveBeenCalledWith('playAcunado')
  })

  it('▲ está deshabilitado en el puesto 1 con etiqueta de borde con sentido', () => {
    renderAltar()
    expect(
      screen.getByRole('button', { name: 'Luffy ya está en el primer puesto' }),
    ).toBeDisabled()
  })

  it('quitar devuelve el hueco y lo anuncia', () => {
    const onChange = vi.fn()
    const { container } = renderAltar({ onChange })

    fireEvent.click(screen.getByRole('button', { name: 'Quitar a Zoro del altar' }))

    const [next, meta] = onChange.mock.calls[0]
    expect(next.map((e: { slug: string } | null) => e?.slug ?? null)).toEqual([
      'luffy',
      null,
      'naruto',
      null,
      null,
    ])
    expect(meta).toEqual({ type: 'remove', slug: 'zoro' })
    expect(container.querySelector('.af-sr')?.textContent).toContain(
      'Zoro retirado del altar',
    )
  })

  it('una llegada nueva marca su carta con is-arriving (render-adjust)', () => {
    const { container, rerender } = renderAltar()
    rerender(
      <AltarFive
        entries={[
          ENTRIES[0],
          ENTRIES[1],
          ENTRIES[2],
          { slug: 'goku', name: 'Goku' },
          null,
        ]}
      />,
    )
    const card = container.querySelector('[data-slug="goku"]')
    expect(card).toHaveClass('is-arriving')
  })

  it('readOnly/invitado: sin botones de ritual y con etiqueta del dueño', () => {
    renderAltar({ guestUsername: 'yuki' })
    expect(screen.queryByRole('button')).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Altar de yuki' }),
    ).toBeInTheDocument()
  })

  it('altar vacío: juramento 誓 y CTA que enfoca el buscador', () => {
    const onBrowseCatalog = vi.fn()
    render(
      <AltarFive entries={[null, null, null, null, null]} onBrowseCatalog={onBrowseCatalog} />,
    )
    expect(screen.getByText('Construye tu altar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir personajes' }))
    expect(onBrowseCatalog).toHaveBeenCalledTimes(1)
  })
})
