import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  user: { username: 'goku', id: 1 } as Record<string, unknown> | null,
  miWrapped: vi.fn(),
  navigate: vi.fn(),
  paint: vi.fn(async () => undefined),
  share: vi.fn(async () => 'shared'),
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock('../lib/api', () => ({ endpoints: { miWrapped: h.miWrapped } }))
// El santuario usa el sonido global; en tests es un no-op.
vi.mock('../contexts/SoundContext', () => ({ useSound: () => ({ play: vi.fn() }) }))
vi.mock('../components/PersonajeImg', () => ({
  default: ({ nombre }: { nombre: string }) => <img alt={nombre} />,
}))
// El arte de marca no existe en test → caemos al gradiente (sin red).
vi.mock('../lib/brand-assets', () => ({ brandImage: () => null }))
vi.mock('../lib/dailyProgress', () => ({ recordDailyShare: vi.fn() }))
// El pintor canvas 1080×1920 se carga con import() dinámico desde onCompartir;
// lo interceptamos para asertar el cableado sin tocar canvas real.
vi.mock('../features/wrapped/wrapped-story-card', () => ({
  paintWrappedStoryCard: h.paint,
  shareWrappedStoryCard: h.share,
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => h.navigate }
})

import WrappedPage from './WrappedPage'

const FULL = {
  username: 'goku',
  votosTotales: 1234,
  duelosJugados: 10,
  prediccionesAcertadas: 5,
  badgesDesbloqueados: 7,
  personajeTop: { slug: 'gohan', nombre: 'Gohan', anime: 'Dragon Ball', imagenUrl: '/img/gohan.webp' },
  fandomPrincipal: 'Dragon Ball',
  mejorRacha: 8,
  top3: [
    { personajeId: 1, slug: 'gohan', nombre: 'Gohan', imagenUrl: '/g.webp', anime: 'Dragon Ball', votos: 90 },
    { personajeId: 2, slug: 'goku', nombre: 'Goku', imagenUrl: '/k.webp', anime: 'Dragon Ball', votos: 70 },
    { personajeId: 3, slug: 'vegeta', nombre: 'Vegeta', imagenUrl: '/v.webp', anime: 'Dragon Ball', votos: 50 },
  ],
  universoTop: { anime: 'Dragon Ball', slug: 'gohan', pct: 73 },
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WrappedPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WrappedPage (El santuario del Wrapped)', () => {
  beforeEach(() => {
    h.user = { username: 'goku', id: 1 }
    h.miWrapped.mockReset()
    h.navigate.mockReset()
    h.paint.mockClear()
    h.share.mockClear()
  })
  afterEach(() => cleanup())

  it('monta el santuario con un único h1 (el peregrino) y las salas de las cifras presentes', async () => {
    h.miWrapped.mockResolvedValue(FULL)
    renderPage()

    // La Entrada es el ÚNICO h1 de la página (a11y: jamás dos h1). El username
    // del peregrino vive en la misma sala, contiguo al h1.
    const h1s = await waitFor(() => {
      const found = document.querySelectorAll('h1')
      expect(found.length).toBeGreaterThan(0)
      return found
    })
    expect(h1s.length).toBe(1)
    expect(h1s[0].textContent).toContain('Has cruzado el torii')
    // El username del peregrino renderiza (Entrada + tile del emaki).
    expect(screen.getAllByText('@goku').length).toBeGreaterThanOrEqual(1)

    // Cada sala presente tiene su <h2> real (heading accesible).
    expect(screen.getByRole('heading', { level: 2, name: /Tu voz cayó sobre la arena/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: /Tres nombres recibieron tus ofrendas/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: /8 votos seguidos/ })).toBeTruthy()

    // sr-text completo de las cifras (no solo el odómetro decorativo). Robusto
    // al separador de miles del ICU (puede o no agrupar según la versión).
    expect(screen.getByText(/1[\s., ]?234 votos emitidos en la arena en 2026/)).toBeTruthy()
    expect(screen.getByText(/73% de tus votos fueron para Dragon Ball/)).toBeTruthy()

    // El espejo del gusto (universoTop) renderiza su universo.
    expect(screen.getAllByText('Dragon Ball').length).toBeGreaterThanOrEqual(1)

    // Cada sala es una <section> con label de pantalla; entrada + 4 cifras + emaki = 6.
    expect(document.querySelectorAll('[data-screen-label]').length).toBe(6)
  })

  it('OMITE las salas sin dato (top3 vacío → sin altar; racha 0 → sin senda; universoTop null → sin espejo)', async () => {
    // No es el estado vacío (hay duelos jugados), pero faltan las cifras
    // opcionales → entrada + emaki, sin huecos por las salas ausentes.
    h.miWrapped.mockResolvedValue({
      username: 'novato',
      votosTotales: 0,
      duelosJugados: 5,
      prediccionesAcertadas: 0,
      badgesDesbloqueados: 2,
      personajeTop: null,
      fandomPrincipal: null,
      mejorRacha: 0,
      top3: [],
      universoTop: null,
    })
    renderPage()

    // Entrada (h1) + emaki siempre; el resto fuera.
    await waitFor(() => expect(document.querySelectorAll('h1').length).toBe(1))
    expect(screen.queryByRole('heading', { level: 2, name: /Tu voz cayó sobre la arena/ })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /Tres nombres recibieron tus ofrendas/ })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /votos seguidos|toda llama empieza/ })).toBeNull()
    expect(screen.queryByText(/de tus votos fueron para/)).toBeNull()
    // Solo entrada + emaki.
    expect(document.querySelectorAll('[data-screen-label]').length).toBe(2)
  })

  it('usa copy con cariño cuando la racha es exactamente 1', async () => {
    h.miWrapped.mockResolvedValue({ ...FULL, mejorRacha: 1 })
    renderPage()
    expect(
      await screen.findByRole('heading', { level: 2, name: /toda llama empieza por una/ }),
    ).toBeTruthy()
  })

  it('cablea onCompartir al pintor de la story-card y comparte', async () => {
    h.miWrapped.mockResolvedValue(FULL)
    renderPage()
    const btn = await screen.findByRole('button', { name: /Compartir mi emaki/ })
    fireEvent.click(btn)
    await waitFor(() => expect(h.paint).toHaveBeenCalledTimes(1))
    expect(h.share).toHaveBeenCalledTimes(1)
    // cardData con el mapeo del DTO real.
    const cardData = h.paint.mock.calls[0][1]
    expect(cardData).toMatchObject({ username: 'goku', votosTotales: 1234, fandomPrincipal: 'Dragon Ball' })
    // shareText identity-first: abre con el oshi/fandom, NO con la cifra fría.
    const shareText = h.share.mock.calls[0][1].text as string
    expect(shareText.startsWith('Mi oshi Nº1 es Gohan')).toBe(true)
    expect(shareText).toContain('mi fandom Nº1 es Dragon Ball')
    expect(shareText).toContain('1234 votos')
    expect(shareText.indexOf('Gohan')).toBeLessThan(shareText.indexOf('1234'))
  })

  it('navega a la arena (/votar) desde "Volver a la arena"', async () => {
    h.miWrapped.mockResolvedValue(FULL)
    renderPage()
    const volver = await screen.findByRole('button', { name: /Volver a la arena/ })
    fireEvent.click(volver)
    expect(h.navigate).toHaveBeenCalledWith('/votar')
  })

  it('redirige a /login conservando next=/wrapped si no hay usuario (link viral)', () => {
    h.user = null
    const LoginProbe = () => {
      const loc = useLocation()
      return <div data-testid="login-stub" data-search={loc.search} />
    }
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/wrapped']}>
          <Routes>
            <Route path="/wrapped" element={<WrappedPage />} />
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    // El guard NO monta el santuario…
    expect(container.querySelector('[data-screen-label]')).not.toBeInTheDocument()
    // …y aterriza en /login arrastrando el next (LoginPage ya honra ?next=).
    const stub = screen.getByTestId('login-stub')
    expect(stub).toBeInTheDocument()
    expect(decodeURIComponent(stub.getAttribute('data-search') || '')).toBe('?next=/wrapped')
  })

  it('muestra el onboarding (no el santuario vacío) cuando el wrapped está a cero', async () => {
    h.miWrapped.mockResolvedValue({
      username: 'novato',
      votosTotales: 0,
      duelosJugados: 0,
      prediccionesAcertadas: 0,
      badgesDesbloqueados: 0,
      personajeTop: null,
      fandomPrincipal: null,
      mejorRacha: 0,
      top3: [],
      universoTop: null,
    })
    renderPage()
    // Onboarding alentador con CTA a /votar; SIN salas del santuario.
    expect(await screen.findByText(/Tu temporada acaba de empezar/)).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /Vota tu primer duelo/ })
    expect(cta).toHaveAttribute('href', '/votar')
    expect(document.querySelector('[data-screen-label]')).not.toBeInTheDocument()
    // Sigue habiendo un único h1 (el del onboarding, no dos).
    expect(document.querySelectorAll('h1').length).toBe(1)
  })

  it('muestra el estado de carga y el de error con reintento', async () => {
    // Carga: query pendiente (promesa que no resuelve en el test).
    h.miWrapped.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderPage()
    expect(screen.getByText(/Calculando tu resumen/)).toBeInTheDocument()
    unmount()

    // Error: la query rechaza → mensaje + botón de reintento.
    h.miWrapped.mockReset()
    h.miWrapped.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText(/No pudimos cargar tu Wrapped/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })
})
