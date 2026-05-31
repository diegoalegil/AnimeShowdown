import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PackOpening from './PackOpening'

const playMock = vi.fn()

vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt, className = '' }) => (
    <span role="img" aria-label={alt} className={className} />
  ),
}))

const baseCarta = {
  colorDominante: 'rgb(10 14 21)',
  poseida: true,
  cantidad: 1,
  elo: 1200,
}

const fastTiming = {
  charge: 1,
  tear: 1,
  firstReveal: 2,
  normalStep: 2,
  climaxStep: 2,
  summaryNormal: 2,
  summarySpecial: 2,
}

const revealEspecial = {
  especial: true,
  saldoRestante: 50,
  monedasDuplicados: 10,
  cartas: [
    {
      posicion: 1,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: {
        ...baseCarta,
        id: 1,
        personajeSlug: 'naruto',
        personajeNombre: 'Naruto Uzumaki',
        anime: 'Naruto',
        rareza: 'SSR',
      },
    },
    {
      posicion: 2,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: {
        ...baseCarta,
        id: 2,
        personajeSlug: 'luffy',
        personajeNombre: 'Monkey D. Luffy',
        anime: 'One Piece',
        rareza: 'SSR',
      },
    },
    {
      posicion: 3,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: {
        ...baseCarta,
        id: 3,
        personajeSlug: 'goku',
        personajeNombre: 'Goku',
        anime: 'Dragon Ball',
        rareza: 'SSR',
      },
    },
    {
      posicion: 4,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: {
        ...baseCarta,
        id: 4,
        personajeSlug: 'frieren',
        personajeNombre: 'Frieren',
        anime: 'Frieren',
        rareza: 'SSR',
      },
    },
    {
      posicion: 5,
      nueva: false,
      recompensaDuplicado: 10,
      climax: 'ESPECIAL',
      carta: {
        ...baseCarta,
        id: 5,
        personajeSlug: 'satoru_gojo',
        personajeNombre: 'Satoru Gojo',
        anime: 'Jujutsu Kaisen',
        rareza: 'ESPECIAL',
        especialCurada: true,
        arteUrl: '/assets/cartas-especiales/satoru_gojo.webp',
      },
    },
  ],
}

describe('PackOpening', () => {
  beforeEach(() => {
    playMock.mockClear()
  })

  it('revela las cartas del servidor y termina en resumen', async () => {
    render(
      <PackOpening
        reveal={revealEspecial}
        puedeAbrirOtro
        abriendo={false}
        onAbrirOtro={() => {}}
        onCerrar={() => {}}
        timing={fastTiming}
      />,
    )

    expect(screen.getByText('Sobre Premium')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('Naruto Uzumaki').length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      expect(screen.getByText('Resumen del sobre')).toBeInTheDocument()
    })
    expect(screen.getByAltText('Satoru Gojo')).toBeInTheDocument()
    expect(screen.getByText('Duplicada +10')).toBeInTheDocument()
    expect(playMock).toHaveBeenCalledWith('playWhoosh')
    expect(playMock).toHaveBeenCalledWith('playLevelUp')
  })
})
