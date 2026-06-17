import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Contrato de la integración "El Teatro del Torneo" (pieza 116) ────────────
// El teatro ENMARCA la página /torneos/:slug: el proscenio es la cabecera (el
// ÚNICO <h1> = torneo.nombre, con microdata SportsEvent) y el cuerpo rico
// (bracket vivo + paneles) vive DENTRO del marco como children. La "función"
// scrubbable + coronación se reservan a torneos FINISHED. Aquí asertamos contra
// el SHAPE REAL del backend (array PLANO de enfrentamientos, no Match[][]).

// useTorneoBySlug: el dato del torneo lo controla cada test. Re-exportamos
// getEstadoBadge REAL (el proscenio lo usa para el badge de estado).
const torneoState = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../lib/torneosQueries', async () => {
  const actual = await vi.importActual<typeof import('../lib/torneosQueries')>(
    '../lib/torneosQueries',
  )
  return {
    ...actual,
    useTorneoBySlug: () => ({
      data: torneoState.current,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  }
})

// useSeo + JsonLd: no tocan document.head en el test.
vi.mock('../hooks/useSeo', () => ({ useSeo: vi.fn() }))
vi.mock('../components/JsonLd', () => ({ default: () => null }))

// Sonidos del teatro: no-ops en jsdom (Web Audio no existe).
vi.mock('../lib/sounds', () => ({
  playWhoosh: vi.fn(),
  playClack: vi.fn(),
  playVerdictStamp: vi.fn(),
  playAcunado: vi.fn(),
  playSello: vi.fn(),
  playCampanilla: vi.fn(),
}))

// Imágenes / kanji animados: marcadores ligeros (sin CDN ni chunk de strokes).
vi.mock('../components/PersonajeCutImg', () => ({
  default: ({ slug }: { slug?: string }) => <img alt="" data-slug={slug} />,
}))
vi.mock('../components/PersonajeImg', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))
vi.mock('../components/KanjiStroke', () => ({
  default: ({ kanji }: { kanji?: string }) => <span data-testid="kanji-stroke">{kanji}</span>,
}))

// Paneles y piezas ricas: stub a marcadores identificables. Si la integración
// del teatro dejara de montar alguno, su marcador desaparece y el test cae
// (guard de cero-regresión: los children DEBEN seguir montados dentro del marco).
vi.mock('../components/Bracket', () => ({
  default: () => <div data-testid="bracket">bracket vivo</div>,
}))
vi.mock('../components/LiveMatchSpectator', () => ({
  default: () => <div data-testid="live-spectator">en vivo</div>,
}))
vi.mock('../components/DuelosAbiertosStrip', () => ({
  default: () => <div data-testid="duelos-abiertos">duelos abiertos</div>,
}))
vi.mock('../components/ShareButtons', () => ({
  default: () => <div data-testid="share-buttons">compartir</div>,
}))
vi.mock('../components/ReactionsBar', () => ({
  default: () => <div data-testid="reactions-bar">reacciones</div>,
}))
vi.mock('../features/torneos/seal/ChampionSeal', () => ({
  default: () => <div data-testid="champion-seal">sello del campeón</div>,
}))
vi.mock('../components/PersonajeCard', () => ({
  default: ({ nombre }: { nombre?: string }) => (
    <div data-testid="personaje-card">{nombre}</div>
  ),
}))

// Hooks de predicción de la página: estables y vacíos (sin red).
vi.mock('../hooks/usePredicciones', () => ({
  useMisPredicciones: () => ({ data: [], isLoading: false }),
  useAplicarPrediccionCampeon: () => ({ mutate: vi.fn(), isPending: false }),
  useLeaderboardPrediccionesTorneo: () => ({ data: [], isLoading: false, isError: false }),
}))

// VisualPageShell: passthrough (evita el loop de canvas de AtmosphereEffects).
vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// AuthContext: usuario anónimo estable.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

import TorneoDetailPage from './TorneoDetailPage'

// ── Builders de datos con el SHAPE REAL (array PLANO de enfrentamientos) ──────
function persona(slug: string, nombre: string, anime = 'Anime') {
  return { id: slug, slug, nombre, anime }
}

// Bracket de 4 → semifinales (ronda 1, 2 matches) + final (ronda 2, 1 match).
// `ganador` truthy ⇒ resuelto; los votos van en personaje1Votos/personaje2Votos.
function enfrentamientosFinalizados() {
  const goku = persona('goku', 'Goku', 'Dragon Ball')
  const vegeta = persona('vegeta', 'Vegeta', 'Dragon Ball')
  const luffy = persona('luffy', 'Luffy', 'One Piece')
  const zoro = persona('zoro', 'Zoro', 'One Piece')
  return [
    { id: 1, ronda: 1, personaje1: goku, personaje2: vegeta, ganador: goku, personaje1Votos: 120, personaje2Votos: 80, totalVotos: 200 },
    { id: 2, ronda: 1, personaje1: luffy, personaje2: zoro, ganador: luffy, personaje1Votos: 90, personaje2Votos: 70, totalVotos: 160 },
    { id: 3, ronda: 2, personaje1: goku, personaje2: luffy, ganador: goku, personaje1Votos: 150, personaje2Votos: 100, totalVotos: 250 },
  ]
}

function enfrentamientosEnCurso() {
  const goku = persona('goku', 'Goku', 'Dragon Ball')
  const vegeta = persona('vegeta', 'Vegeta', 'Dragon Ball')
  const luffy = persona('luffy', 'Luffy', 'One Piece')
  const zoro = persona('zoro', 'Zoro', 'One Piece')
  return [
    { id: 1, ronda: 1, personaje1: goku, personaje2: vegeta, ganador: goku, personaje1Votos: 120, personaje2Votos: 80, totalVotos: 200 },
    { id: 2, ronda: 1, personaje1: luffy, personaje2: zoro, ganador: null, personaje1Votos: 12, personaje2Votos: 9, totalVotos: 21 },
    { id: 3, ronda: 2, personaje1: null, personaje2: null, ganador: null, personaje1Votos: 0, personaje2Votos: 0, totalVotos: 0 },
  ]
}

function makeTorneo(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    slug: 'shonen-supremo',
    nombre: 'Shonen Supremo',
    descripcion: 'El torneo definitivo de protagonistas shonen.',
    estado: 'FINISHED',
    fechaInicio: '2026-01-10T18:00:00.000Z',
    fechaFinalizacion: '2026-02-10T18:00:00.000Z',
    numParticipantes: 4,
    totalRondas: 2,
    ganadorSlug: 'goku',
    currentMatch: null,
    enfrentamientos: enfrentamientosFinalizados(),
    ...overrides,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/torneos/shonen-supremo']}>
        <Routes>
          <Route path="/torneos/:slug" element={<TorneoDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  torneoState.current = makeTorneo()
})
afterEach(() => cleanup())

describe('TorneoDetailPage — integración El Teatro del Torneo', () => {
  it('mantiene EXACTAMENTE un <h1> = el proscenio con el nombre del torneo y microdata', () => {
    renderPage()
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Shonen Supremo')
    expect(h1s[0]).toHaveAttribute('itemProp', 'name')
  })

  it('preserva el cuerpo rico DENTRO del marco: bracket vivo + paneles + share', () => {
    renderPage()
    expect(screen.getByTestId('bracket')).toBeInTheDocument()
    expect(screen.getByTestId('champion-seal')).toBeInTheDocument()
    expect(screen.getByTestId('share-buttons')).toBeInTheDocument()
    expect(screen.getByTestId('reactions-bar')).toBeInTheDocument()
  })

  it('SCHEDULED → muestra la Tablilla con la fecha y NO ofrece "ver la función"', () => {
    torneoState.current = makeTorneo({
      estado: 'SCHEDULED',
      ganadorSlug: null,
      enfrentamientos: enfrentamientosEnCurso().map((e) => ({ ...e, ganador: null })),
    })
    renderPage()
    expect(screen.getByText('PRÓXIMA FUNCIÓN')).toBeInTheDocument()
    // Fecha formateada por dateUtils (locale es-ES, fechaInicio).
    expect(screen.getByText(/enero de 2026/i)).toBeInTheDocument()
    expect(screen.queryByText(/ver la función/i)).not.toBeInTheDocument()
    // Los children (p.ej. el panel de predicción) siguen montados debajo.
    expect(screen.getByTestId('champion-seal')).toBeInTheDocument()
  })

  it('IN_PROGRESS → marco ligero: bracket visible, SIN control "ver la función"', () => {
    torneoState.current = makeTorneo({
      estado: 'IN_PROGRESS',
      ganadorSlug: null,
      currentMatch: { id: 2 },
      enfrentamientos: enfrentamientosEnCurso(),
    })
    renderPage()
    expect(screen.getByTestId('bracket')).toBeInTheDocument()
    expect(screen.getByTestId('live-spectator')).toBeInTheDocument()
    expect(screen.getByTestId('duelos-abiertos')).toBeInTheDocument()
    expect(screen.queryByText(/ver la función/i)).not.toBeInTheDocument()
  })

  it('FINISHED → "ver la función" abre el scrubber + narrador; deriva el estado; corona al campeón', async () => {
    renderPage()

    // El control existe en FINISHED.
    const verBtn = await screen.findByRole('button', { name: /ver la función/i })
    fireEvent.click(verBtn)

    // Abre el overlay: scrubber NATIVO (role=slider) + narrador aria-live.
    const slider = await screen.findByRole('slider', { name: /línea temporal de la función/i })
    expect(slider).toBeInTheDocument()
    // Narrador: región aria-live=polite con una frase por paso (no vacía).
    const narrador = document.querySelector('p[aria-live="polite"]')
    expect(narrador).toBeTruthy()
    expect(narrador?.textContent?.trim().length ?? 0).toBeGreaterThan(0)

    // Pausar para controlar el scrubber a mano (la función arranca reproduciendo).
    const pausa = await screen.findByRole('button', { name: /pausar la función/i })
    fireEvent.click(pausa)

    // Scrubbear a un paso intermedio NO debe romper (estado derivado idempotente).
    fireEvent.change(slider, { target: { value: '1' } })
    await waitFor(() => expect(slider).toHaveValue('1'))

    // Scrubbear al final (3 duelos resueltos) → aparece la coronación del campeón.
    fireEvent.change(slider, { target: { value: '3' } })
    await waitFor(() => {
      const coronacion = screen.getByRole('region', { name: /coronación de Goku/i })
      expect(coronacion).toBeInTheDocument()
      // El nombre del campeón se estampa dentro de la ceremonia.
      expect(within(coronacion).getByText('Goku')).toBeInTheDocument()
    })

    // "← volver al cuadro" cierra el overlay → el bracket vuelve a ser visible.
    fireEvent.click(screen.getByRole('button', { name: /volver al cuadro/i }))
    await waitFor(() => expect(screen.queryByRole('slider')).not.toBeInTheDocument())
  })

  it('al salir del overlay restaura el foco al botón "ver la función" (no cae al <body>)', async () => {
    renderPage()
    const verBtn = await screen.findByRole('button', { name: /ver la función/i })
    fireEvent.click(verBtn)

    // Salir con "volver al cuadro" → el botón se remonta y recibe el foco.
    fireEvent.click(await screen.findByRole('button', { name: /volver al cuadro/i }))
    await waitFor(() => expect(screen.queryByRole('slider')).not.toBeInTheDocument())
    const remontado = await screen.findByRole('button', { name: /ver la función/i })
    await waitFor(() => {
      expect(remontado).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })
  })

  it('aria-label del duelo NO adelanta finalistas mientras el asiento está vacío durante el scrub', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /ver la función/i }))
    const slider = await screen.findByRole('slider', { name: /línea temporal de la función/i })
    fireEvent.click(await screen.findByRole('button', { name: /pausar la función/i }))

    // Paso 0: la final (ronda 2) aún no tiene finalistas sentados → su rollo se
    // anuncia "por definir contra por definir", nunca adelantando a los reales.
    fireEvent.change(slider, { target: { value: '0' } })
    await waitFor(() => expect(slider).toHaveValue('0'))
    const labels = screen.getAllByRole('group').map((d) => d.getAttribute('aria-label') ?? '')
    // La final con asientos vacíos se anuncia honesta (ambos lados "por definir").
    expect(labels.some((l) => /por definir contra por definir/i.test(l))).toBe(true)
    // La final (Goku vs Luffy en los datos) NO debe anunciarse por nombre en el
    // paso 0: sus asientos están vacíos en la vista. Antes del fix el aria-label
    // los adelantaba ("Duelo: Goku contra Luffy") pese al "asiento vacío".
    expect(labels.some((l) => /goku contra luffy|luffy contra goku/i.test(l))).toBe(false)
  })
})
