import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

import IntencionSelector from './IntencionSelector'
import { INTENCIONES } from '../../../data/voto-intenciones.js'

// globals:false en vitest → RTL no registra su auto-cleanup. Sin esto, los
// pills de un test quedan en el DOM y getByText del siguiente ve duplicados.
afterEach(() => cleanup())

describe('IntencionSelector (selector de intención de voto)', () => {
  it('pinta una pill por cada intención del catálogo', () => {
    const { getByText } = render(<IntencionSelector onSelect={() => {}} />)
    for (const intencion of INTENCIONES) {
      expect(getByText(intencion.label)).toBeInTheDocument()
    }
  })

  it('al tocar una pill notifica onSelect con su id', () => {
    const onSelect = vi.fn()
    const { getByText } = render(<IntencionSelector onSelect={onSelect} />)
    fireEvent.click(getByText('Poder'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('poder')
  })

  it('es set-once: tras elegir, una segunda pill ya no dispara onSelect', () => {
    const onSelect = vi.fn()
    const { getByText } = render(<IntencionSelector onSelect={onSelect} />)
    fireEvent.click(getByText('Poder'))
    fireEvent.click(getByText('Carisma'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('poder')
  })

  it('es skippable: sin interacción no llama a onSelect', () => {
    const onSelect = vi.fn()
    render(<IntencionSelector onSelect={onSelect} />)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disabled bloquea la selección por completo', () => {
    const onSelect = vi.fn()
    const { getByText } = render(<IntencionSelector onSelect={onSelect} disabled />)
    fireEvent.click(getByText('Favorito'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
