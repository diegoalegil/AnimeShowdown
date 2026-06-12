import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — componente .jsx sin tipos
import { HearthHeroView, HearthOdometer } from './HearthHero'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../hooks/useInstantSoundPress', () => ({
  useInstantSoundPress: () => ({ onPointerDown: vi.fn(), onClick: vi.fn() }),
}))

vi.mock('../hooks/useReducedMotionPref', () => ({
  useReducedMotionPref: vi.fn(() => false),
}))

afterEach(() => {
  cleanup()
  vi.mocked(useReducedMotionPref).mockReturnValue(false)
})

type HearthProps = {
  votosComunidad?: number | null
  torneosEnVivo?: number | null
}

function renderHearth(props: HearthProps = {}) {
  return render(
    <MemoryRouter>
      <HearthHeroView {...props} />
    </MemoryRouter>,
  )
}

function rerenderHearth(
  rerender: (ui: React.ReactElement) => void,
  props: HearthProps = {},
) {
  rerender(
    <MemoryRouter>
      <HearthHeroView {...props} />
    </MemoryRouter>,
  )
}

describe('HearthHeroView', () => {
  it('pinta titular, números y las 3 tablillas con sus rutas', () => {
    renderHearth({ votosComunidad: 1234, torneosEnVivo: 2 })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'hero.tituloAntes hero.tituloAnime hero.tituloDespues',
    )
    expect(screen.getByText('hero.statVotos')).toBeInTheDocument()
    expect(screen.getByText('hero.statTorneos')).toBeInTheDocument()

    const tablillas = screen.getByRole('navigation', { name: 'hero.accionesAria' })
    const links = Array.from(tablillas.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(links).toEqual(['/votar', '/torneos', '/games'])
  })

  it('sin datos muestra "—" sin romper la coreografía', () => {
    const { container } = renderHearth({ votosComunidad: null, torneosEnVivo: null })
    const cifras = container.querySelectorAll('.hearth-odo')
    expect(cifras).toHaveLength(2)
    expect(cifras[0]).toHaveTextContent('—')
    expect(cifras[1]).toHaveTextContent('—')
    // Sin dato de torneos no hay dot "en vivo" ni frase de vacío.
    expect(container.querySelector('.hearth-stat__dot')).toBeNull()
    expect(container.querySelector('.hearth-stat__vacio')).toBeNull()
  })

  it('0 torneos en marcha enseña la frase de encendido, no un 0', () => {
    const { container } = renderHearth({ votosComunidad: 50, torneosEnVivo: 0 })
    expect(screen.getByText('hero.statTorneosVacioCta')).toBeInTheDocument()
    expect(container.querySelector('.hearth-stat__dot')).toBeNull()
  })

  it('con torneos en juego enciende el dot de en vivo', () => {
    const { container } = renderHearth({ votosComunidad: 50, torneosEnVivo: 3 })
    expect(container.querySelector('.hearth-stat__dot')).not.toBeNull()
    expect(container.querySelector('.hearth-stat__vacio')).toBeNull()
  })

  describe('hito de millar', () => {
    it('el primer dato fija la línea base sin animar', () => {
      const { container, rerender } = renderHearth({ votosComunidad: null })
      rerenderHearth(rerender, { votosComunidad: 3998 })
      expect(container.querySelector('.hearth-hito-pop')).toBeNull()
    })

    it('cruzar el millar dispara el pop UNA vez y un re-render no lo repite', () => {
      const { container, rerender } = renderHearth({ votosComunidad: 3998 })
      expect(container.querySelector('.hearth-hito-pop')).toBeNull()

      rerenderHearth(rerender, { votosComunidad: 4002 })
      expect(container.querySelector('.hearth-hito-pop')).not.toBeNull()

      // Mismo valor otra vez: la key no cambia, el wrapper no se re-monta.
      const popAntes = container.querySelector('.hearth-hito-pop')
      rerenderHearth(rerender, { votosComunidad: 4002 })
      expect(container.querySelector('.hearth-hito-pop')).toBe(popAntes)
    })

    it('subir votos dentro del mismo millar no dispara nada', () => {
      const { container, rerender } = renderHearth({ votosComunidad: 4002 })
      rerenderHearth(rerender, { votosComunidad: 4900 })
      expect(container.querySelector('.hearth-hito-pop')).toBeNull()
    })
  })

  it('en modo estático marca data-hearth-static (calma/reduced-motion)', () => {
    vi.mocked(useReducedMotionPref).mockReturnValue(true)
    const { container } = renderHearth({ votosComunidad: 10, torneosEnVivo: 1 })
    expect(
      container.querySelector('section[data-hearth-static="true"]'),
    ).not.toBeNull()
  })
})

describe('HearthOdometer', () => {
  it('formatea con separador de millar y expone la cifra legible en sr-only', () => {
    const { container } = render(<HearthOdometer value={1234567} instant />)
    expect(container.querySelector('.sr-only')).toHaveTextContent('1.234.567')
    // 7 columnas de dígito + 2 separadores decorativos.
    expect(container.querySelectorAll('.hearth-odo__col')).toHaveLength(7)
    expect(container.querySelectorAll('.hearth-odo__sep')).toHaveLength(2)
  })

  it('instant=true coloca las tiras en su dígito final sin esperar la entrada', () => {
    const { container } = render(<HearthOdometer value={42} instant />)
    const strips = Array.from(
      container.querySelectorAll<HTMLElement>('.hearth-odo__strip'),
    )
    expect(strips.map((s) => s.style.transform)).toEqual([
      'translateY(-4em)',
      'translateY(-2em)',
    ])
  })

  it('null muestra el guion largo', () => {
    const { container } = render(<HearthOdometer value={null} />)
    expect(container.querySelector('.hearth-odo')).toHaveTextContent('—')
  })
})
