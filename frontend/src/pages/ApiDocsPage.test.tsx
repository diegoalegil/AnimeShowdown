import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// useSeo: spy inspeccionable para asertar el contrato SEO real (no solo "no peta").
const seoSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSeo', () => ({ useSeo: seoSpy }))

// JsonLd espía: captura el schema recibido por id para asertar el contrato SEO
// (breadcrumbs) sin tocar document.head.
const jsonLd = vi.hoisted(() => ({
  calls: [] as Array<{ id?: string; schema: unknown }>,
}))
vi.mock('../components/JsonLd', () => ({
  default: ({ id, schema }: { id?: string; schema: unknown }) => {
    jsonLd.calls.push({ id, schema })
    return null
  },
}))

import ApiDocsPage from './ApiDocsPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ApiDocsPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  jsonLd.calls.length = 0
  seoSpy.mockClear()
})

// Contrato de contenido: TODOS los endpoints reales por (sección → método+ruta).
// Si un reskin recorta o renombra una ruta, este test cae.
const RESOURCES: Array<[string, Array<[string, string]>]> = [
  [
    'Personajes',
    [
      ['GET', '/api/personajes'],
      ['GET', '/api/personajes/catalogo'],
      ['GET', '/api/personajes/{id}'],
      ['GET', '/api/personajes/{slug}'],
    ],
  ],
  [
    'Torneos',
    [
      ['GET', '/api/torneos'],
      ['GET', '/api/torneos/slug/{slug}'],
    ],
  ],
  [
    'Ranking',
    [
      ['GET', '/api/votos/ranking'],
      ['GET', '/api/votos/ranking/segmentado?periodo=all|mes|trimestre|anio&anime=&limit='],
      ['GET', '/api/votos/ranking/animes-disponibles'],
    ],
  ],
  [
    'Votar',
    [
      ['GET', '/api/votar/sugerir-duelo'],
      ['GET', '/api/enfrentamientos/aleatorio'],
    ],
  ],
  [
    'Perfiles públicos',
    [
      ['GET', '/api/perfil/{username}'],
      ['GET', '/api/seguidores/usuario/{username}/{seguidos|seguidores|stats}'],
    ],
  ],
  ['Logros', [['GET', '/api/logros']]],
  ['Predicciones', [['GET', '/api/predicciones/leaderboard?dias=30&limit=10']]],
  [
    'Estado',
    [
      ['GET', '/api/status'],
      ['GET', '/actuator/health'],
    ],
  ],
  [
    'OG images',
    [
      ['GET', '/api/og/personaje/{slug}.png'],
      ['GET', '/api/og/torneo/{slug}.png'],
      ['GET', '/api/og/ranking.png'],
      ['GET', '/api/og/anime/{slug}.png'],
      ['GET', '/api/og/duelo/{slugA}/vs/{slugB}.png'],
      ['GET', '/api/og/pvp.png'],
    ],
  ],
]

// Normaliza el texto de una ruta partida en <span> ({param} en oro): el
// crawler ve el textContent concatenado, no los nodos sueltos.
function flat(node: Element | null): string {
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('ApiDocsPage («los planos del API»)', () => {
  it('conserva el h1 y la estructura de las 8 secciones de recurso', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Endpoints REST' }),
    ).toBeInTheDocument()
    for (const [titulo] of RESOURCES) {
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument()
    }
  })

  it('presenta TODOS los endpoints reales (método + ruta) como texto crawlable', () => {
    const { container } = renderPage()
    // Cada ruta vive en al menos un <code class="apibp-route"> con su textContent
    // exacto, presente en el DOM aunque el acordeón esté plegado.
    const routes = Array.from(container.querySelectorAll('.apibp-route')).map(flat)
    for (const [, endpoints] of RESOURCES) {
      for (const [method, path] of endpoints) {
        expect(routes).toContain(path)
        // El método viaja en su sello, siempre visible (distinguible sin color).
        expect(
          screen.getAllByText(method, { selector: '.apibp-seal' }).length,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('mantiene las descripciones técnicas exactas de cada endpoint', () => {
    renderPage()
    // La descripción viaja como summary SIEMPRE visible + de nuevo en el panel
    // de detalle: ambas en el DOM (crawlable). getAllByText tolera el duplicado
    // intencional sin dejar pasar una pérdida (length > 0).
    expect(
      screen.getAllByText(
        'Lista personajes paginados por defecto. Usa page, size y anime; size se limita para evitar respuestas masivas.',
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Detalle de un personaje por slug URL-safe.').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(
        'Devuelve un enfrentamiento real abierto de torneo, si existe; 404 activa el modo casual.',
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('OG image 1200x630 para el modo duelo PvP live.').length,
    ).toBeGreaterThan(0)
  })

  it('cada endpoint es un acordeón accesible (h3 > button[aria-expanded])', () => {
    renderPage()
    const toggles = screen.getAllByRole('button', { expanded: false })
    // 23 endpoints reales en total (4+2+3+2+2+1+1+2+6).
    const total = RESOURCES.reduce((n, [, eps]) => n + eps.length, 0)
    expect(total).toBe(23)
    expect(toggles.length).toBe(total)
    // Cada toggle está dentro de un h3 (jerarquía de la doc).
    for (const btn of toggles) {
      expect(btn.closest('h3')).not.toBeNull()
    }
  })

  it('conserva los CTAs externos (Swagger, OpenAPI JSON, Healthcheck) y los enlaces internos', () => {
    renderPage()
    const ctas: Array<[string | RegExp, string]> = [
      [/Swagger/, 'https://api.animeshowdown.dev/swagger-ui/index.html'],
      ['OpenAPI JSON', 'https://api.animeshowdown.dev/v3/api-docs'],
      ['Healthcheck', 'https://api.animeshowdown.dev/actuator/health'],
    ]
    for (const [name, href] of ctas) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(screen.getByRole('link', { name: '¿Cómo funciona el ranking?' })).toHaveAttribute(
      'href',
      '/faq',
    )
    expect(screen.getByRole('link', { name: 'Ver ranking en vivo' })).toHaveAttribute(
      'href',
      '/ranking',
    )
  })

  it('emite el JsonLd de breadcrumbs Inicio → API docs', () => {
    renderPage()
    const ids = jsonLd.calls.map((c) => c.id)
    expect(ids).toContain('breadcrumbs')
    const breadcrumbs = jsonLd.calls.find((c) => c.id === 'breadcrumbs')?.schema as {
      '@type': string
      itemListElement: Array<{ name: string }>
    }
    expect(breadcrumbs['@type']).toBe('BreadcrumbList')
    expect(breadcrumbs.itemListElement.map((el) => el.name)).toEqual(['Inicio', 'API docs'])
  })

  it('emite el SEO de la página (título + descripción)', () => {
    renderPage()
    expect(seoSpy).toHaveBeenCalledTimes(1)
    expect(seoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'API pública',
        description: expect.stringContaining('Endpoints REST públicos de AnimeShowdown'),
      }),
    )
  })

  it('un ejemplo de respuesta lleva botón copiar con label accesible', () => {
    renderPage()
    const seccion = screen
      .getByRole('heading', { level: 2, name: 'Personajes' })
      .closest('section') as HTMLElement
    const copyBtn = within(seccion).getAllByRole('button', {
      name: /Copiar ejemplo de respuesta para \/api\/personajes/,
    })
    expect(copyBtn.length).toBeGreaterThan(0)
  })
})
