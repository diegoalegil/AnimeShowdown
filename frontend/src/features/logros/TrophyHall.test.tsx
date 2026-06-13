import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — componente .jsx sin tipos
import TrophyHall from './TrophyHall'

const play = vi.fn()
vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play }),
}))

vi.mock('../../lib/brand-assets', () => ({
  brandImage: () => null,
}))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  play.mockClear()
})

const ESTANTERIAS = [
  {
    kanji: '伝',
    name: 'Legendarios',
    tier: 'gold',
    items: [
      {
        codigo: 'leyenda',
        kanji: '王',
        nombre: 'Leyenda',
        descripcion: 'Gana un torneo',
        unlocked: true,
        fecha: '2026-06-10T10:00:00',
        nuevo: false,
        count: 3,
      },
    ],
  },
  {
    kanji: '常',
    name: 'Comunes',
    tier: 'bronze',
    items: [
      {
        codigo: 'primer_voto',
        kanji: '初',
        nombre: 'Primer voto',
        descripcion: 'Vota una vez',
        unlocked: true,
        fecha: '2026-06-12T10:00:00',
        nuevo: true,
        count: 120,
      },
      {
        codigo: 'cien_votos',
        kanji: '百',
        nombre: 'Centurión',
        descripcion: 'Vota 100 veces',
        unlocked: false,
        fecha: null,
        nuevo: false,
        count: 12,
      },
    ],
  },
]

describe('TrophyHall', () => {
  it('escaparate sin sesión: medallas a plena luz, sin contador de sala ni ceremonia', () => {
    const { container } = render(
      <TrophyHall estanterias={ESTANTERIAS} logueado={false} />,
    )
    expect(container.querySelector('.th-counter')).toBeNull()
    expect(container.querySelectorAll('.th-medal.is-lograda').length).toBeGreaterThan(0)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(play).not.toHaveBeenCalled()
  })

  it('logueado: fecha en la medalla lograda, conteo comunidad en la pendiente y contador de sala', () => {
    const { container } = render(
      <TrophyHall estanterias={ESTANTERIAS} logueado />,
    )
    // la medalla lograda muestra fecha + count comunitario en la misma meta
    expect(screen.getByText(/10 jun 2026/)).toBeInTheDocument()
    expect(screen.getByText(/12 lo tienen/)).toBeInTheDocument()
    expect(container.querySelector('.th-counter')).not.toBeNull()
  })

  it('estampado en vivo: el nuevo entra como silueta, se estampa con sonido y persiste los vistos', () => {
    const onVistos = vi.fn()
    const { container } = render(
      <TrophyHall estanterias={ESTANTERIAS} logueado onEstampadosVistos={onVistos} />,
    )
    const medalla = container.querySelector('#logro-primer_voto .th-medal')
    // en cola: silueta aunque está desbloqueado
    expect(medalla).toHaveClass('is-pendiente')

    act(() => {
      vi.advanceTimersByTime(750)
    })
    expect(container.querySelector('#logro-primer_voto .th-medal')).toHaveClass('is-stamping')
    expect(play).toHaveBeenCalledWith('playVerdictStamp')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(container.querySelector('#logro-primer_voto .th-medal')).toHaveClass('is-lograda')
    expect(screen.getByText(/Logro conseguido: Primer voto/)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onVistos).toHaveBeenCalledWith(['primer_voto'])
  })

  it('deep-link ?logro= marca su medalla', () => {
    const { container } = render(
      <TrophyHall estanterias={ESTANTERIAS} logueado logroDestacado="cien_votos" />,
    )
    expect(container.querySelector('#logro-cien_votos .th-medal')).toHaveClass(
      'th-medal--destacada',
    )
  })

  it('estantería completa gana el remate; incompleta no', () => {
    const { container } = render(
      <TrophyHall estanterias={ESTANTERIAS} logueado />,
    )
    const shelves = container.querySelectorAll('.th-shelf')
    expect(shelves[0]).toHaveClass('th-shelf--completa')
    expect(shelves[1]).not.toHaveClass('th-shelf--completa')
  })
})
