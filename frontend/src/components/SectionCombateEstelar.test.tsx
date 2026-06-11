import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SectionCombateEstelar from './SectionCombateEstelar'
import { getCombateEstelarDelDia } from '../lib/combate-estelar'
import { CATALOGO } from '../lib/combate-estelar.fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../hooks/useInstantSoundPress', () => ({
  useInstantSoundPress: () => ({ onPointerDown: vi.fn(), onClick: vi.fn() }),
}))

vi.mock('./AtmosphereEffects', () => ({
  Embers: () => null,
  LightningStrike: () => null,
}))

// Factory async: vi.mock se iza por encima de los imports, así que el
// catálogo compartido se resuelve con un import dinámico dentro del factory.
vi.mock('../hooks/usePersonajesCatalogo', async () => {
  const { CATALOGO: catalogo } = await import('../lib/combate-estelar.fixtures')
  return {
    usePersonajesCatalogo: () => ({
      personajes: catalogo,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  }
})

const FECHA = new Date(2026, 5, 11, 12, 0, 0)

function renderSection() {
  return render(
    <MemoryRouter>
      <SectionCombateEstelar />
    </MemoryRouter>,
  )
}

describe('SectionCombateEstelar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FECHA)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renderiza a los dos contendientes del día con link a su perfil', () => {
    const esperado = getCombateEstelarDelDia(CATALOGO, FECHA)
    expect(esperado).not.toBeNull()
    if (!esperado) return

    renderSection()

    const linkRetador = screen.getByRole('link', {
      name: new RegExp(esperado.retador.nombre),
    })
    const linkRival = screen.getByRole('link', {
      name: new RegExp(esperado.rival.nombre),
    })
    expect(linkRetador).toHaveAttribute('href', `/personajes/${esperado.retador.slug}`)
    expect(linkRival).toHaveAttribute('href', `/personajes/${esperado.rival.slug}`)
  })

  it('el CTA apunta directo al duelo del día en /votar', () => {
    const esperado = getCombateEstelarDelDia(CATALOGO, FECHA)
    expect(esperado).not.toBeNull()
    if (!esperado) return

    renderSection()

    const cta = screen.getByRole('link', { name: /combate\.cta/ })
    expect(cta).toHaveAttribute(
      'href',
      `/votar?personaje=${esperado.retador.slug}&rival=${esperado.rival.slug}`,
    )
  })

  it('pinta el mismo cartel en renders repetidos del mismo día (sin aleatoriedad)', () => {
    const primera = renderSection()
    const nombresPrimera = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    primera.unmount()

    renderSection()
    const nombresSegunda = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(nombresSegunda).toEqual(nombresPrimera)
  })
})
