import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// useSeo: spy inspeccionable para asertar el contrato SEO real (title /
// description / canonical / image) — no solo "no peta".
const seoSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSeo', () => ({ useSeo: seoSpy }))

// VisualPageShell deja pasar los children (sin canvas/atmósfera en test).
// CinematicHero pinta el h1 editorial + actions + children para poder
// asertar el h1 y el botón de compartir sin montar el motor visual.
vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CinematicHero: ({
    title,
    actions,
    children,
  }: {
    title: ReactNode
    actions?: ReactNode
    children?: ReactNode
  }) => (
    <header>
      <h1>{title}</h1>
      {actions}
      {children}
    </header>
  ),
}))

vi.mock('../data/visual-assets', () => ({
  BRAND_VISUALS: {
    ranking: { image: '/img/stage/ranking.webp' },
    empty: { image: '/img/stage/empty.webp' },
  },
}))

// EmptyState: passthrough mínimo (no se usa en el camino feliz, pero evita
// arrastrar el sistema visual real si el catálogo viniera vacío).
vi.mock('../components/EmptyState', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

// PersonajeImg (lo usa TopPlate): stub determinista que no toca el catálogo
// real ni dispara red. Asserta el slug y el alt para no ocultar regresiones.
vi.mock('../components/PersonajeImg', () => ({
  default: ({ slug, alt }: { slug: string; alt?: string }) => (
    <img data-testid="portrait" data-slug={slug} alt={alt ?? ''} />
  ),
}))

// JsonLd espía: captura el schema recibido por id para asertar el contrato
// SEO (rankingItemList + FAQPage) sin tocar document.head.
const jsonLd = vi.hoisted(() => ({
  calls: [] as Array<{ id?: string; schema: unknown }>,
}))
vi.mock('../components/JsonLd', () => ({
  default: ({ id, schema }: { id?: string; schema: unknown }) => {
    jsonLd.calls.push({ id, schema })
    return null
  },
}))

// Catálogo + ELO canónico deterministas: filas conocidas, orden conocido.
// Ana > Beto > Caro por ELO descendente.
const DOMINANTE = 'var(--color-surface)'
const CATALOGO = [
  { slug: 'beto', nombre: 'Beto', anime: 'Anime B', imagenColorDominante: DOMINANTE },
  { slug: 'ana', nombre: 'Ana', anime: 'Anime A', imagenColorDominante: DOMINANTE },
  { slug: 'caro', nombre: 'Caro', anime: 'Anime C', imagenColorDominante: DOMINANTE },
]
// El componente PREFIERE el ELO canónico del backend sobre el sintético
// (eloCanonico?.[slug] ?? getStatsPersonaje). Mocks DIVERGENTES para que los
// asserts (1900/1700/1500) solo pasen si se pinta el canónico, no el sintético.
const ELO: Record<string, number> = { ana: 1900, beto: 1700, caro: 1500 }
const ELO_SINTETICO: Record<string, number> = { ana: 111, beto: 222, caro: 333 }

vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({ personajes: CATALOGO, isLoading: false }),
}))
vi.mock('../hooks/useRanking', () => ({
  useEloCanonico: () => ({ data: ELO }),
}))
vi.mock('../lib/personajes-core', () => ({
  getStatsPersonaje: (slug: string) => ({ elo: ELO_SINTETICO[slug] ?? 1500, wins: 0, losses: 0 }),
}))
vi.mock('../lib/dailyProgress', () => ({
  recordDailyRankingView: vi.fn(),
  recordDailyShare: vi.fn(),
}))
vi.mock('../lib/share', () => ({ shareOrCopy: vi.fn() }))

import EditorialRankingPage from './EditorialRankingPage'

const SLUG = 'mejores-personajes-anime'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/rankings/${SLUG}`]}>
      <Routes>
        <Route path="/rankings/:slug" element={<EditorialRankingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  jsonLd.calls.length = 0
  seoSpy.mockClear()
})

describe('EditorialRankingPage (lámina TopPlate)', () => {
  it('conserva el h1 editorial de la página', () => {
    renderPage()
    // CinematicHero sigue siendo el dueño del h1 con el título de la página.
    expect(
      screen.getByRole('heading', { level: 1, name: /Mejores personajes/i }),
    ).toBeInTheDocument()
  })

  it('pinta las filas del ranking en el MISMO orden (por ELO desc) con nombre, universo y ELO', () => {
    renderPage()
    const items = screen.getAllByRole('listitem')
    // Tres personajes del catálogo, ordenados Ana > Beto > Caro.
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('Ana')).toBeInTheDocument()
    expect(within(items[0]).getByText('Anime A')).toBeInTheDocument()
    expect(within(items[0]).getByText('1900')).toBeInTheDocument()
    expect(within(items[1]).getByText('Beto')).toBeInTheDocument()
    expect(within(items[1]).getByText('1700')).toBeInTheDocument()
    expect(within(items[2]).getByText('Caro')).toBeInTheDocument()
    expect(within(items[2]).getByText('1500')).toBeInTheDocument()
    // El <ol> propaga la posición: el primer puesto vale 1 (podio).
    expect(items[0].getAttribute('value')).toBe('1')
  })

  it('enlaza cada fila a la ficha del personaje', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Ana/i })).toHaveAttribute(
      'href',
      '/personajes/ana',
    )
  })

  it('renderiza la prosa SEO (children) literal bajo la tabla', () => {
    renderPage()
    // Bloque "qué contiene" — texto editorial íntegro, crawlable.
    expect(screen.getByText('Qué contiene esta página')).toBeInTheDocument()
    expect(
      screen.getByText(/La lista se construye con personajes reales del catálogo/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No es canon oficial\. Es una vista de producto/i),
    ).toBeInTheDocument()
    // Cross-links a otras landings editoriales.
    expect(screen.getByText('Más rankings para explorar')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Personajes más fuertes de anime/i }),
    ).toHaveAttribute('href', '/rankings/personajes-mas-fuertes-anime')
  })

  it('conserva el botón de compartir el ranking', () => {
    renderPage()
    expect(
      screen.getByRole('button', { name: /Compartir top/i }),
    ).toBeInTheDocument()
  })

  it('emite el JsonLd rankingItemList con los items en orden + el FAQPage editorial', () => {
    renderPage()
    const ids = jsonLd.calls.map((c) => c.id)
    expect(ids).toContain('ranking-item-list')
    expect(ids).toContain('faq-editorial-ranking')

    const itemList = jsonLd.calls.find((c) => c.id === 'ranking-item-list')?.schema as {
      '@type': string
      mainEntity: {
        '@type': string
        numberOfItems: number
        itemListElement: Array<{
          position: number
          item: {
            name: string
            url: string
            additionalProperty: { '@type': string; name: string; value: number }
          }
        }>
      }
    }
    expect(itemList['@type']).toBe('CollectionPage')
    expect(itemList.mainEntity.itemListElement.map((el) => el.item.name)).toEqual([
      'Ana',
      'Beto',
      'Caro',
    ])
    expect(itemList.mainEntity.itemListElement.map((el) => el.position)).toEqual([1, 2, 3])
    // El dato central del ranking (ELO) viaja en el structured data; debe ser el
    // CANÓNICO (1900/1700/1500), no el sintético — y enlazar la ficha.
    expect(itemList.mainEntity.numberOfItems).toBe(3)
    expect(
      itemList.mainEntity.itemListElement.map((el) => el.item.additionalProperty),
    ).toEqual([
      { '@type': 'PropertyValue', name: 'ELO', value: 1900 },
      { '@type': 'PropertyValue', name: 'ELO', value: 1700 },
      { '@type': 'PropertyValue', name: 'ELO', value: 1500 },
    ])
    expect(itemList.mainEntity.itemListElement[0].item.url).toMatch(/\/personajes\/ana$/)

    const faq = jsonLd.calls.find((c) => c.id === 'faq-editorial-ranking')?.schema as {
      '@type': string
      mainEntity: Array<{ name: string; acceptedAnswer: { '@type': string; text: string } }>
    }
    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity).toHaveLength(3)
    expect(faq.mainEntity[1].name).toBe('¿Es un ranking oficial de anime?')
    expect(faq.mainEntity.map((q) => q.acceptedAnswer['@type'])).toEqual([
      'Answer',
      'Answer',
      'Answer',
    ])
    // La prosa SEO del rich-snippet (acceptedAnswer.text) — no solo el @type.
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain('ordena por ELO')
    expect(faq.mainEntity[1].acceptedAnswer.text).toContain('no decide canon ni poder oficial')
    expect(faq.mainEntity[2].acceptedAnswer.text).toContain('Vota duelos, reta personajes')
  })

  it('emite el SEO de la página con el canonical correcto', () => {
    renderPage()
    expect(seoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mejores personajes de anime',
        canonical: 'https://animeshowdown.dev/rankings/mejores-personajes-anime',
        description: expect.stringContaining('Ranking de los mejores personajes'),
        image: '/api/og/ranking.png',
      }),
    )
  })
})
