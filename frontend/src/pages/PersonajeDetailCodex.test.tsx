import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { personajes, syncCatalogoPersonajes } from '../lib/personajes-core'

// Catálogo de prueba: un universo con dos personajes (para rank de anime) y un
// `id` numérico en el protagonista → la ReactionsBar (gateada por backend id)
// se monta. Mismo shape que el catálogo real (slug/nombre/anime/imagenUrl/id).
const CATALOGO_TEST = [
  {
    id: 42,
    slug: 'goku',
    nombre: 'Goku',
    anime: 'Dragon Ball',
    descripcion: 'El saiyan criado en la Tierra.',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/goku.webp',
  },
  {
    id: 43,
    slug: 'vegeta',
    nombre: 'Vegeta',
    anime: 'Dragon Ball',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/vegeta.webp',
  },
]

// ── Contrato del FighterCodex (pieza 124) en la ficha de personaje ───────────
// La cabecera-libro reskina el hero y reorganiza el cuerpo en PLIEGOS-tabs, pero
// la ficha debe seguir montando TODAS las secciones ricas preexistentes
// (reacciones, historial competitivo, comentarios, galería) y mantenerlas
// crawlables. Aquí: secciones presentes, tabs accesibles que cambian de pliego,
// stats/ELO del fighter estampados, y el contrato SEO (useSeo canonical/title).

// useSeo: spy inspeccionable para asertar el contrato SEO real.
const seoSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSeo', () => ({ useSeo: seoSpy }))

// JsonLd: espía que captura el schema por id (no toca document.head).
const jsonLd = vi.hoisted(() => ({ calls: [] as Array<{ id?: string }> }))
vi.mock('../components/JsonLd', () => ({
  default: ({ id }: { id?: string }) => {
    jsonLd.calls.push({ id })
    return null
  },
}))

// Sonido + view-transitions del códice: no-ops en jsdom.
vi.mock('../lib/sounds', () => ({
  playWhoosh: vi.fn(),
  playSello: vi.fn(),
  playVerdictStamp: vi.fn(),
  playClack: vi.fn(),
}))
vi.mock('../lib/viewTransitions', () => ({
  adoptPersonajeHero: vi.fn(),
  releasePersonajeHero: vi.fn(),
}))

// PersonajeImg: <img> simple para evitar el pipeline de srcset/CDN.
vi.mock('../components/PersonajeImg', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

// Datos externos (Jikan / AnimeChan): resueltos a vacío.
vi.mock('../lib/jikan', () => ({
  buscarPersonajeJikan: () => Promise.resolve(null),
}))
vi.mock('../lib/animechan', () => ({
  citaPersonaje: () => Promise.resolve(null),
}))

// Hooks de datos de la página: vacíos pero estables (sin red).
vi.mock('../hooks/useImagenesPersonaje', () => ({
  useImagenesPersonaje: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useVotosPeriodo', () => ({
  useVotosPeriodo: () => ({ data: undefined }),
}))
vi.mock('../hooks/usePersonajesSimilares', () => ({
  usePersonajesSimilares: () => ({ data: [], isLoading: false }),
}))

// Sonido global de la ficha (cita).
vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
  useSoundOptional: () => ({ play: vi.fn() }),
}))

// VisualPageShell: passthrough (evita el loop de canvas de AtmosphereEffects,
// que en jsdom dispara ticks tras el teardown). Conservamos los children.
vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

// Endpoints: el códice pide elo-history/matchups vía useQuery; sin red →
// devolvemos vacío (río seco honesto / páginas en blanco).
vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {
    status?: number
  },
  endpoints: {
    personajeEloHistory: () => Promise.resolve([]),
    // Shape REAL del endpoint: MatchupResumenDto (objeto), NO un array. El
    // códice normaliza por totalEnfrentamientos/rivalesFrecuentes; mockear []
    // enmascaraba el bug de "páginas en blanco" (Array.isArray siempre false).
    matchupsPersonaje: () =>
      Promise.resolve({
        totalEnfrentamientos: 0,
        mejoresMatchups: [],
        peoresMatchups: [],
        rivalesFrecuentes: [],
      }),
  },
}))

// Secciones ricas preexistentes: stub a un marcador identificable. Si la
// integración del códice dejara de montar alguna, su marcador desaparece y el
// test cae (guard de cero-regresión).
vi.mock('../components/ReactionsBar', () => ({
  default: () => <div data-testid="reactions-bar">reacciones</div>,
}))
vi.mock('../components/HistorialCompetitivo', () => ({
  default: ({ nombre }: { nombre: string }) => (
    <div data-testid="historial-competitivo">historial de {nombre}</div>
  ),
}))
vi.mock('../components/ComentariosPersonaje', () => ({
  default: ({ nombre }: { nombre: string }) => (
    <div data-testid="comentarios">comentarios de {nombre}</div>
  ),
}))
vi.mock('../components/ByobuGallery', () => ({
  default: () => <div data-testid="byobu-gallery">galeria</div>,
}))
vi.mock('../components/EloHistoryChart', () => ({
  default: () => <div data-testid="elo-history-chart">elo chart</div>,
}))

// Stubs ligeros para piezas con dependencias pesadas (3D, contexts auth, etc.).
vi.mock('../components/PersonajeCardHolo', () => ({ default: () => <div /> }))
vi.mock('../components/PersonajeCardBack', () => ({ default: () => <div /> }))
vi.mock('../components/CardFlip', () => ({
  default: ({ front }: { front: React.ReactNode }) => <div>{front}</div>,
}))
vi.mock('../components/ExhibitStand', () => ({ default: () => null }))
vi.mock('../components/Personaje3D', () => ({ default: () => null }))
vi.mock('../components/SeguirPersonajeButton', () => ({
  default: () => <button type="button">Seguir</button>,
}))
vi.mock('../components/ShareButtons', () => ({ default: () => <div /> }))
vi.mock('../components/QuoteScroll', () => ({ default: () => null }))
vi.mock('../features/personajes/components/RetoRecomendado', () => ({
  default: () => null,
}))

import PersonajeDetailPage from './PersonajeDetailPage'

function renderFicha(slug = 'goku') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/personajes/${slug}`]}>
        <Routes>
          <Route path="/personajes/:slug" element={<PersonajeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  personajes.splice(0, personajes.length)
  syncCatalogoPersonajes(CATALOGO_TEST)
  seoSpy.mockClear()
  jsonLd.calls.length = 0
})

afterEach(() => cleanup())

describe('PersonajeDetailPage — integración FighterCodex', () => {
  it('estampa el nombre del fighter en el H1 con Microdata Person', () => {
    renderFicha('goku')
    const h1 = screen.getByRole('heading', { level: 1, name: 'Goku' })
    expect(h1).toHaveAttribute('itemProp', 'name')
  })

  it('muestra el ELO base y el % de victorias del fighter en los sellos', () => {
    renderFicha('goku')
    // Sello 印 con el ELO de getStatsPersonaje('goku'). El número es SINTÉTICO,
    // así que el texto accesible debe llevar el calificador "base estimado"
    // (regla de honestidad del módulo) — asertamos ese sr-text, no un "ELO N"
    // pelado que presentaría el dato como competitivo.
    expect(screen.getByText(/ELO base estimado \d+/)).toBeInTheDocument()
    // El sello de % victorias estampa un porcentaje (goku tiene combates).
    expect(screen.getByText(/% de victorias|sin clasificar aún/)).toBeInTheDocument()
  })

  it('monta los pliegos como tabs accesibles y cambia de sección al pulsarlos', async () => {
    renderFicha('goku')
    const tablist = screen.getByRole('tablist', { name: /pliegos de la ficha/i })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(4)

    // Stats arranca seleccionado y pinta su panel.
    const statsTab = screen.getByRole('tab', { name: /戦.*Stats/s })
    expect(statsTab).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', { name: /estadísticas de combate/i }),
    ).toBeInTheDocument()

    // Cambiar al pliego del río de tinta (史 · historial). El cambio encadena
    // cierre→apertura con timers (ease-brush), así que esperamos al commit.
    const rioTab = screen.getByRole('tab', { name: /史.*Río de tinta/s })
    fireEvent.click(rioTab)
    await waitFor(() =>
      expect(rioTab).toHaveAttribute('aria-selected', 'true'),
    )
    expect(statsTab).toHaveAttribute('aria-selected', 'false')
  })

  it('navega entre pliegos con flechas y deja el foco en el TAB destino (no en el panel)', async () => {
    renderFicha('goku')
    const statsTab = screen.getByRole('tab', { name: /戦.*Stats/s })
    statsTab.focus()
    expect(statsTab).toHaveFocus()

    // ArrowRight → siguiente pliego (史 · Río de tinta) según el orden PLIEGOS.
    fireEvent.keyDown(statsTab, { key: 'ArrowRight' })

    const rioTab = screen.getByRole('tab', { name: /史.*Río de tinta/s })
    // El pliego destino queda seleccionado…
    await waitFor(() => expect(rioTab).toHaveAttribute('aria-selected', 'true'))
    // …y el foco viaja al TAB (roving tabindex, patrón APG), NUNCA al tabpanel:
    // regresión del bug donde selectPleat robaba el foco hacia el panel y rompía
    // la navegación por teclado del tablist.
    await waitFor(() => expect(rioTab).toHaveFocus())
    expect(document.activeElement?.getAttribute('role')).toBe('tab')
  })

  it('conserva las secciones ricas preexistentes, crawlables', () => {
    renderFicha('goku')
    expect(screen.getByTestId('reactions-bar')).toBeInTheDocument()
    expect(screen.getByTestId('historial-competitivo')).toBeInTheDocument()
    expect(screen.getByTestId('comentarios')).toBeInTheDocument()
    expect(screen.getByTestId('byobu-gallery')).toBeInTheDocument()
    expect(screen.getByTestId('elo-history-chart')).toBeInTheDocument()
  })

  it('preserva el contrato SEO useSeo (title con ELO base, type profile)', () => {
    renderFicha('goku')
    expect(seoSpy).toHaveBeenCalled()
    const opts = seoSpy.mock.calls.at(-1)?.[0]
    expect(opts.title).toContain('Goku')
    expect(opts.title).toContain('ELO base')
    expect(opts.type).toBe('profile')
    // JSON-LD intacto: personaje + breadcrumbs.
    expect(jsonLd.calls.map((c) => c.id)).toEqual(
      expect.arrayContaining(['personaje', 'breadcrumbs']),
    )
  })

  it('emite exactamente un H1 (sin duplicar el nombre del frontispicio)', () => {
    renderFicha('goku')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
