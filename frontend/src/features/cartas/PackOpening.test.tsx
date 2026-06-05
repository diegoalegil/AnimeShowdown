import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PackOpening from './PackOpening'

const playMock = vi.fn()
const warmMock = vi.fn()

vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock, warm: warmMock }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt, className = '' }) => (
    <span role="img" aria-label={alt} className={className} />
  ),
}))

const baseCarta = {
  colorDominante: 'var(--color-surface)',
  poseida: true,
  cantidad: 1,
  elo: 1200,
}

const fastTiming = {
  peel: 1,
  rip: 1,
  autoFlipNormal: 1,
  autoCollectNormal: 1,
  revealDingDelay: 1,
  collect: 1,
  nextDelay: 1,
  flash: 1,
  flashSpecial: 1,
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
    warmMock.mockClear()
  })

  it('rasga el sobre, revela las cartas del servidor y termina en resumen', async () => {
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

    expect(screen.getByRole('button', { name: 'Rasgar sobre' })).toBeInTheDocument()
    expect(screen.queryByText('Resumen del sobre')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rasgar sobre' }))

    // Timeouts holgados: bajo cobertura en CI la instrumentación ralentiza el
    // render de la secuencia de reveal y el default de 1000ms daba falsos
    // negativos (flaky). El `timing` rápido ya hace la animación instantánea.
    await waitFor(
      () => {
        expect(screen.getAllByText('Naruto Uzumaki').length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )

    const climaxButton = await screen.findByRole(
      'button',
      { name: 'Revelar carta 5' },
      { timeout: 4000 },
    )
    fireEvent.click(climaxButton)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ver resumen' }, { timeout: 4000 }),
    )

    await waitFor(
      () => {
        expect(screen.getByText('Resumen del sobre')).toBeInTheDocument()
      },
      { timeout: 4000 },
    )
    expect(screen.getByAltText('Satoru Gojo')).toBeInTheDocument()
    expect(screen.getByText('Duplicada +10')).toBeInTheDocument()
    expect(playMock).toHaveBeenCalledWith('playPackCharge')
    expect(playMock).toHaveBeenCalledWith('playPackTear')
    expect(playMock).toHaveBeenCalledWith('playPackRevealSpecial')
  })
})
