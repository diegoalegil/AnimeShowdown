import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventoDetailPage from './EventoDetailPage'

/**
 * Integracion del takeover "Matsuri nocturno" sobre /eventos/:slug contra el
 * shape REAL del evento (inicioISO/finISO/titulo/descripcionCorta). Cubre:
 *  - UN solo h1 = titulo del evento.
 *  - Contenido real preservado (mision, mini-stats, podio, roster).
 *  - Senda de hitos = <ol> con el reached-count correcto para un evento ACTIVO.
 *  - PROXIMO: countdown protagonista, sin celebracion de hanabi de entrada.
 *  - PASADO: copia de despedida.
 *  - reduced-motion degrada (parallax off, faroles estaticos).
 */

// Reloj fijo para que getEstadoEvento/deriveHitosEvento sean deterministas.
const NOW = new Date('2026-06-06T00:00:00Z')

// Evento de 8 dias: inicio 01 jun, fin 09 jun. Con NOW=06 jun -> ACTIVO; las
// fases Apertura(01)+Ecuador(05) ya pasaron, Recta final(07)+Cierre(09) no.
const EVENTO_ACTIVO = {
  slug: 'matsuri-activo',
  titulo: 'Festival de Verano',
  descripcionCorta: 'La procesion del festival ilumina la calle',
  tipo: { kind: 'anime', valor: 'X' },
  inicioISO: '2026-06-01T00:00:00Z',
  finISO: '2026-06-09T00:00:00Z',
  color: 'amber',
  emoji: '🏮',
}
const EVENTO_PROXIMO = {
  ...EVENTO_ACTIVO,
  slug: 'matsuri-proximo',
  titulo: 'Festival que Viene',
  inicioISO: '2026-06-20T00:00:00Z',
  finISO: '2026-06-28T00:00:00Z',
}
const EVENTO_PASADO = {
  ...EVENTO_ACTIVO,
  slug: 'matsuri-pasado',
  titulo: 'Festival Cerrado',
  inicioISO: '2026-05-01T00:00:00Z',
  finISO: '2026-05-09T00:00:00Z',
}

const TODOS = [EVENTO_ACTIVO, EVENTO_PROXIMO, EVENTO_PASADO]

const PARTICIPANTES = [
  { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' },
  { slug: 'zoro', nombre: 'Zoro', anime: 'One Piece' },
  { slug: 'nami', nombre: 'Nami', anime: 'One Piece' },
  { slug: 'usopp', nombre: 'Usopp', anime: 'One Piece' },
]
const ELOS: Record<string, number> = { luffy: 2000, zoro: 1980, nami: 1800, usopp: 1500 }

vi.mock('../hooks/useSeo', () => ({ useSeo: vi.fn() }))
vi.mock('../components/JsonLd', () => ({ default: () => null }))
vi.mock('../components/EditorialCover', () => ({
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('../components/PersonajeCutImg', () => ({ default: () => <div data-testid="cut-img" /> }))
vi.mock('../components/PersonajeImg', () => ({ default: () => <div data-testid="img" /> }))
vi.mock('../data/visual-assets', () => ({
  BRAND_VISUALS: { empty: {} },
  getEventVisual: () => ({ image: '/x.webp', kanji: '祭' }),
}))

// useEventos devuelve la lista controlada; getEventoPorSlug (real) la resuelve.
vi.mock('../hooks/useEventos', () => ({ useEventos: () => TODOS }))

// Participantes y stats controlados; el resto de data/eventos es REAL (estado,
// countdown, deriveHitosEvento viven en festival-core, no aqui).
vi.mock('../data/eventos', async () => {
  const actual = await vi.importActual<typeof import('../data/eventos')>('../data/eventos')
  return {
    ...actual,
    getPersonajesEvento: () => PARTICIPANTES,
  }
})
vi.mock('../lib/personajes-core', () => ({
  getStatsPersonaje: (slug: string) => ({ elo: ELOS[slug] ?? 1000 }),
}))

// Preferencia de movimiento controlable por test (flag mutable).
const motionPref = { reduce: false }
vi.mock('../hooks/useReducedMotionPref', () => ({
  useReducedMotionPref: () => motionPref.reduce,
}))

function renderEvento(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/eventos/${slug}`]}>
      <Routes>
        <Route path="/eventos/:slug" element={<EventoDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  motionPref.reduce = false
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  cleanup()
})

describe('EventoDetailPage — matsuri (evento ACTIVO)', () => {
  it('mantiene EXACTAMENTE un h1 = titulo del evento', () => {
    renderEvento(EVENTO_ACTIVO.slug)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Festival de Verano')
  })

  it('preserva el contenido real: mision, mini-stats, podio y roster', () => {
    renderEvento(EVENTO_ACTIVO.slug)
    // Mision (texto por estado ACTIVO): copy honesto, sin afirmar que los votos
    // del evento mueven el ELO; remite al ranking competitivo real.
    expect(screen.getByText(/Roster ordenado por ELO base estimado/)).toBeInTheDocument()
    // Mini-stats: Participantes / Top 100 / ELO base max (etiqueta honesta).
    expect(screen.getByText('Participantes')).toBeInTheDocument()
    expect(screen.getByText('Top 100')).toBeInTheDocument()
    expect(screen.getByText('ELO base máx')).toBeInTheDocument()
    // Podio: #1 del evento es Luffy (elo mas alto).
    expect(screen.getByText('#1 del evento')).toBeInTheDocument()
    // Roster: los 4 participantes aparecen.
    for (const p of PARTICIPANTES) {
      expect(screen.getAllByText(p.nombre).length).toBeGreaterThan(0)
    }
    // Ranking heading (h2) presente.
    expect(
      screen.getByRole('heading', { level: 2, name: /entre top 25 global|ordenados por ELO/ }),
    ).toBeInTheDocument()
  })

  it('renderiza la senda de hitos como <ol> con 2 fases alcanzadas', () => {
    renderEvento(EVENTO_ACTIVO.slug)
    const ol = screen.getByRole('list', { name: /Procesion del evento/i })
    const piedras = within(ol).getAllByRole('listitem')
    expect(piedras).toHaveLength(4) // Apertura/Ecuador/Recta final/Cierre
    const encendidas = piedras.filter((li) => li.className.includes('is-on'))
    expect(encendidas).toHaveLength(2) // Apertura + Ecuador (NOW=06 jun)
    // aria-current="step" sobre el ultimo alcanzado (Ecuador, indice 1).
    expect(piedras[1]).toHaveAttribute('aria-current', 'step')
    expect(piedras[0]).not.toHaveAttribute('aria-current')
  })

  it('etiqueta el ELO como "ELO base" (honestidad: es sintetico, no competitivo)', () => {
    const { container } = renderEvento(EVENTO_ACTIVO.slug)
    // Podio + roster muestran "ELO base {n}", nunca "ELO {n}" a secas.
    const conBase = screen.getAllByText(/ELO base \d+/)
    expect(conBase.length).toBeGreaterThan(0)
    // Ninguna superficie muestra "ELO {n}" sin el calificador "base".
    const todoTexto = container.textContent ?? ''
    expect(/ELO (?!base)\d/.test(todoTexto)).toBe(false)
    // La mision NO afirma que los votos del evento muevan el ELO.
    expect(screen.queryByText(/para mover su ELO/)).toBeNull()
  })

  it('estado ACTIVO arma la celebracion de hanabi (pool de crisantemos)', () => {
    const { container } = renderEvento(EVENTO_ACTIVO.slug)
    // 3 crisantemos + el destello reduced; con motion activa los crisantemos
    // existen en el DOM (el disparo es por clase via effect).
    expect(container.querySelectorAll('.fest-burst')).toHaveLength(3)
    expect(container.querySelector('.fest-hanabi')).toBeTruthy()
  })
})

describe('EventoDetailPage — matsuri (evento PROXIMO)', () => {
  it('muestra el countdown protagonista (hero) y ninguna fase alcanzada', () => {
    const { container } = renderEvento(EVENTO_PROXIMO.slug)
    // Countdown en modo hero.
    expect(container.querySelector('.fest-count--hero')).toBeTruthy()
    // Estado kicker "Empieza en {Nd Mh}" (formato corto formatRestante).
    expect(screen.getByText(/Empieza en \d+d \d+h/)).toBeInTheDocument()
    // Senda: 0 piedras encendidas (el evento aun no empieza).
    const ol = screen.getByRole('list', { name: /Procesion del evento/i })
    const encendidas = within(ol)
      .getAllByRole('listitem')
      .filter((li) => li.className.includes('is-on'))
    expect(encendidas).toHaveLength(0)
  })

  it('NO dispara celebracion de hanabi de entrada (estado != ACTIVO)', () => {
    const { container } = renderEvento(EVENTO_PROXIMO.slug)
    vi.advanceTimersByTime(200)
    // Ningun crisantemo en "is-firing" ni destello "is-flashing": sin entrada.
    expect(container.querySelector('.fest-burst.is-firing')).toBeNull()
    expect(container.querySelector('.fest-hanabi--flash.is-flashing')).toBeNull()
  })

  it('puesto CERRADO: el cuerpo es inert (saca los <Link> del foco/arbol a11y)', () => {
    const { container } = renderEvento(EVENTO_PROXIMO.slug)
    // El stall de Ranking (con persiana) lleva inert en su cuerpo: los <Link>
    // del podio/roster quedan fuera del orden de Tab y del arbol accesible.
    const cerrados = container.querySelectorAll('.fest-stall--cerrado .fest-stall__body')
    expect(cerrados.length).toBeGreaterThan(0)
    cerrados.forEach((body) => expect(body.hasAttribute('inert')).toBe(true))
    // Coherencia: un cuerpo abierto (estado ACTIVO) NO es inert.
    cleanup()
    const { container: activo } = renderEvento(EVENTO_ACTIVO.slug)
    activo
      .querySelectorAll('.fest-stall:not(.fest-stall--cerrado) .fest-stall__body')
      .forEach((body) => expect(body.hasAttribute('inert')).toBe(false))
  })
})

describe('EventoDetailPage — matsuri (evento PASADO)', () => {
  it('muestra la despedida y el escenario terminado', () => {
    const { container } = renderEvento(EVENTO_PASADO.slug)
    expect(screen.getByText(/El matsuri ha cerrado sus puertas/)).toBeInTheDocument()
    expect(screen.getByText(/quedó sellado como resultado final/)).toBeInTheDocument()
    expect(container.querySelector('.fest--terminado')).toBeTruthy()
    // El podio (resultado final) se conserva.
    expect(screen.getByText('#1 del evento')).toBeInTheDocument()
  })

  it('todas las fases de la senda estan alcanzadas', () => {
    renderEvento(EVENTO_PASADO.slug)
    const ol = screen.getByRole('list', { name: /Procesion del evento/i })
    const piedras = within(ol).getAllByRole('listitem')
    expect(piedras.filter((li) => li.className.includes('is-on'))).toHaveLength(4)
  })
})

describe('EventoDetailPage — matsuri (reduced-motion)', () => {
  it('degrada: el escenario lleva data-reduce y conserva el contenido real', () => {
    motionPref.reduce = true
    const { container } = renderEvento(EVENTO_ACTIVO.slug)
    // El gate unico de la pieza: .fest[data-reduce] (parallax off, faroles
    // estaticos, hanabi = destello, countdown sin transiciones via CSS).
    const stage = container.querySelector('.fest')
    expect(stage).toHaveAttribute('data-reduce')
    // Contenido real intacto bajo reduced-motion (un solo h1, podio presente).
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('#1 del evento')).toBeInTheDocument()
    // Los puestos nacen visibles (sin rise) en reduced-motion.
    const stalls = container.querySelectorAll('.fest-stall.is-visible')
    expect(stalls.length).toBeGreaterThan(0)
  })
})
