import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SectionCombateEstelar from './SectionCombateEstelar'
import { getCombateEstelarDelDia } from '../lib/combate-estelar'

const CATALOGO = vi.hoisted(() => [
  { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece', imagenUrl: '/img/One_Piece/luffy.webp', imagenColorDominante: '#aa3322' },
  { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball', imagenUrl: '/img/Dragon_Ball/goku.webp', imagenColorDominante: '#dd7711' },
  { slug: 'naruto', nombre: 'Naruto', anime: 'Naruto', imagenUrl: '/img/Naruto/naruto.webp', imagenColorDominante: '#ddaa11' },
  { slug: 'tanjiro', nombre: 'Tanjiro', anime: 'Demon Slayer', imagenUrl: '/img/Demon_Slayer/tanjiro.webp', imagenColorDominante: '#117755' },
  { slug: 'satoru_gojo', nombre: 'Gojo', anime: 'Jujutsu Kaisen', imagenUrl: '/img/Jujutsu_Kaisen/satoru_gojo.webp', imagenColorDominante: '#3399dd' },
  { slug: 'light_yagami', nombre: 'Light', anime: 'Death Note', imagenUrl: '/img/Death_Note/light_yagami.webp', imagenColorDominante: '#884422' },
  { slug: 'levi', nombre: 'Levi', anime: 'Attack on Titan', imagenUrl: '/img/Attack_on_Titan/levi.webp', imagenColorDominante: '#445566' },
  { slug: 'rem', nombre: 'Rem', anime: 'Re:Zero', imagenUrl: '/img/Re_Zero/rem.webp', imagenColorDominante: '#5577cc' },
])

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

vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({
    personajes: CATALOGO,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

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
