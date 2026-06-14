import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Captura de las props que el MOTOR (RuletaPage) sube al tambor DestinyDrum.
// El test del contrato anti-trampa inspecciona `resultado` y `onPedirGiro`
// sin tocar la física real del componente presentacional.
const drumProps: {
  resultado: { slug: string; spinId: number } | null
  onPedirGiro?: () => void
  onVerFicha?: (p: { slug: string }) => void
} = { resultado: null }

vi.mock('../components/DestinyDrum', () => ({
  default: (props: {
    resultado: { slug: string; spinId: number } | null
    onPedirGiro?: () => void
    onVerFicha?: (p: { slug: string }) => void
  }) => {
    drumProps.resultado = props.resultado
    drumProps.onPedirGiro = props.onPedirGiro
    drumProps.onVerFicha = props.onVerFicha
    return (
      <div data-testid="drum">
        <button type="button" onClick={() => props.onPedirGiro?.()}>
          Girar el destino
        </button>
        <span data-testid="resultado-slug">{props.resultado?.slug ?? ''}</span>
        <span data-testid="resultado-spin">{props.resultado?.spinId ?? ''}</span>
      </div>
    )
  },
}))

vi.mock('../components/JsonLd', () => ({ default: () => null }))

vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../data/visual-assets', () => ({
  getGameVisual: () => ({ image: '/x.webp', kanji: '運' }),
}))

vi.mock('../hooks/useSeo', () => ({ useSeo: vi.fn() }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
}))

const ROSTER = [
  { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
  { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
  { slug: 'nami', nombre: 'Nami', anime: 'One Piece' },
  { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball' },
]

vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({ personajes: ROSTER }),
}))

// Importado DESPUÉS de los mocks.
import RuletaPage from './RuletaPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RuletaPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  drumProps.resultado = null
  drumProps.onPedirGiro = undefined
  drumProps.onVerFicha = undefined
  navigateMock.mockReset()
  globalThis.localStorage?.clear?.()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RuletaPage — contrato anti-trampa', () => {
  it('renderiza la página con el tambor', () => {
    renderPage()
    expect(screen.getByTestId('drum')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /girar el destino/i })).toBeInTheDocument()
  })

  it('al pulsar girar el MOTOR elige un slug del roster y sube spinId nuevo (sin re-sorteo)', () => {
    // Math.random fijo → el motor (no el tambor) elige determinísticamente.
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // floor(0.5 * 4) = 2 → 'nami'
    renderPage()

    expect(screen.getByTestId('resultado-slug').textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /girar el destino/i }))

    // El slug que sube el motor es el que el tambor recibe — no hay otro RNG.
    expect(drumProps.resultado?.slug).toBe('nami')
    expect(drumProps.resultado?.spinId).toBe(1)
    expect(screen.getByTestId('resultado-slug').textContent).toBe('nami')
  })

  it('cada giro incrementa el spinId monotónicamente', () => {
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0) // 'luffy'
    randomSpy.mockReturnValueOnce(0.5) // 'nami'
    renderPage()

    const boton = screen.getByRole('button', { name: /girar el destino/i })

    fireEvent.click(boton)
    expect(drumProps.resultado?.slug).toBe('luffy')
    expect(drumProps.resultado?.spinId).toBe(1)

    fireEvent.click(boton)
    expect(drumProps.resultado?.slug).toBe('nami')
    expect(drumProps.resultado?.spinId).toBe(2)
  })

  it('no usa Math.random durante el render (solo en el handler de giro)', () => {
    const randomSpy = vi.spyOn(Math, 'random')
    renderPage()
    // Render + montaje no deben sortear nada.
    expect(randomSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /girar el destino/i }))
    // El sorteo ocurre SOLO en el handler.
    expect(randomSpy).toHaveBeenCalledTimes(1)
  })

  it('onVerFicha navega a /personajes/:slug', () => {
    renderPage()
    drumProps.onVerFicha?.({ slug: 'zoro' })
    expect(navigateMock).toHaveBeenCalledWith('/personajes/zoro')
  })
})
