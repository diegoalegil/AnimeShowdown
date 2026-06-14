import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// useSeo: spy inspeccionable para asertar el contrato SEO real (no solo "no peta").
const seoSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSeo', () => ({ useSeo: seoSpy }))

// VisualPageShell + CinematicHero: dejan pasar children/título sin canvas ni
// atmósfera en test. CinematicHero pinta el h1 de la página (lo preservamos).
vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CinematicHero: ({ title, subtitle, actions }: { title: ReactNode; subtitle: ReactNode; actions: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions}
    </header>
  ),
}))

vi.mock('../data/visual-assets', () => ({
  BRAND_VISUALS: { ranking: { image: '/img/stage/ranking.webp' } },
}))

// SoundContext: el tratado dispara playSello en el impacto del sello; en test
// el play es un no-op espiable, sin AudioContext.
const playSpy = vi.hoisted(() => vi.fn())
vi.mock('../contexts/SoundContext', () => ({
  useSoundOptional: () => ({ play: playSpy, muted: true, toggleMute: vi.fn(), warm: vi.fn() }),
}))

// JsonLd espía: captura el schema recibido por id para asertar el contrato SEO
// (breadcrumbs + FAQ) sin tocar document.head.
const jsonLd = vi.hoisted(() => ({
  calls: [] as Array<{ id?: string; schema: unknown }>,
}))
vi.mock('../components/JsonLd', () => ({
  default: ({ id, schema }: { id?: string; schema: unknown }) => {
    jsonLd.calls.push({ id, schema })
    return null
  },
}))

import MetodologiaEloPage from './MetodologiaEloPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <MetodologiaEloPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  jsonLd.calls.length = 0
  seoSpy.mockClear()
  playSpy.mockClear()
})

describe('MetodologiaEloPage (el tratado del ELO)', () => {
  it('conserva el h1 de la página y el contenido editorial crawlable', () => {
    renderPage()
    // h1 exacto de la página (CinematicHero) — un único h1.
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Cómo funciona el ranking de AnimeShowdown')

    // Bloques editoriales clave: las InfoCards y la sección "ganar un duelo".
    expect(screen.getByText('ELO base')).toBeInTheDocument()
    expect(screen.getByText('Ranking competitivo')).toBeInTheDocument()
    expect(screen.getByText('Protección antiabuso')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Qué significa ganar un duelo' })).toBeInTheDocument()
    expect(screen.getByText(/Ganar en AnimeShowdown significa que la comunidad eligió/)).toBeInTheDocument()
  })

  it('renderiza el tratado: secciones §01–§05 y las dos fórmulas accesibles', () => {
    renderPage()
    // El rótulo del documento NO es un h1 (el h1 sigue siendo el de la página).
    expect(screen.getByText('ELO', { selector: '.et-title-elo' })).toBeInTheDocument()
    // Secciones del cuerpo del tratado, como texto crawlable.
    expect(screen.getByRole('heading', { name: /§ 01.*El duelo como medida/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /§ 02.*La expectativa/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /§ 03.*La actualización/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /§ 04.*El ejemplo vivo/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /§ 05.*Notas del sistema/ })).toBeInTheDocument()
    // Fórmulas con role=img + aria-label en texto plano (a11y).
    expect(screen.getByRole('img', { name: /Fórmula de la expectativa/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Fórmula de actualización/ })).toBeInTheDocument()
  })

  it('monta el ejemplo vivo interactivo y responde a los sliders sin crashear', () => {
    renderPage()
    const sliderA = screen.getByLabelText('Personaje A') as HTMLInputElement
    const sliderB = screen.getByLabelText('Personaje B') as HTMLInputElement
    expect(sliderA).toBeInTheDocument()
    expect(sliderB).toBeInTheDocument()
    // El chip de K refleja el valor de demostración cableado por la página.
    expect(screen.getByText('K = 32')).toBeInTheDocument()
    // Mover un slider no debe lanzar y debe actualizar el aria-valuetext (la
    // expectativa se recalcula con la matemática ELO del documento).
    expect(() => {
      fireEvent.change(sliderA, { target: { value: '2000' } })
    }).not.toThrow()
    expect(sliderA.value).toBe('2000')
    // Con A muy por encima de B, la expectativa de A debe DISPARARSE (>90 %), no
    // quedarse en 50 %: asertamos el número, no solo el prefijo, para cazar un
    // eloExpectation roto (que devolviera constante) — no un assert vacuo.
    expect(sliderA.getAttribute('aria-valuetext')).toMatch(/2000 puntos ELO, expectativa 9[0-9]/)
  })

  it('emite el JsonLd de breadcrumbs y el FAQPage con las 4 preguntas y respuestas', () => {
    renderPage()
    const ids = jsonLd.calls.map((c) => c.id)
    expect(ids).toContain('breadcrumbs')
    expect(ids).toContain('faq-metodologia')

    const breadcrumbs = jsonLd.calls.find((c) => c.id === 'breadcrumbs')?.schema as {
      '@type': string
      itemListElement: Array<{ name: string }>
    }
    expect(breadcrumbs['@type']).toBe('BreadcrumbList')
    expect(breadcrumbs.itemListElement.map((el) => el.name)).toEqual([
      'Inicio',
      'Metodología del ranking',
    ])

    const faq = jsonLd.calls.find((c) => c.id === 'faq-metodologia')?.schema as {
      '@type': string
      mainEntity: Array<{ name: string; acceptedAnswer: { '@type': string; text: string } }>
    }
    expect(faq['@type']).toBe('FAQPage')
    // Las 4 preguntas del array FAQ, en orden.
    expect(faq.mainEntity.map((q) => q.name)).toEqual([
      '¿AnimeShowdown usa un ELO matemático puro?',
      '¿Qué mueve el ranking competitivo?',
      '¿Los votos invitados cuentan igual?',
      '¿El ranking decide quién es más fuerte en canon?',
    ])
    // El payload SEO del rich snippet son las RESPUESTAS — deben coincidir con
    // el texto crawlable de la página (FAQ array === JSON-LD).
    expect(faq.mainEntity.map((q) => q.acceptedAnswer['@type'])).toEqual([
      'Answer',
      'Answer',
      'Answer',
      'Answer',
    ])
    for (const q of faq.mainEntity) {
      expect(screen.getByText(q.acceptedAnswer.text)).toBeInTheDocument()
    }
  })

  it('emite el SEO de la página (título, descripción, canonical, image)', () => {
    renderPage()
    expect(seoSpy).toHaveBeenCalledTimes(1)
    expect(seoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Metodología del ranking',
        canonical: 'https://animeshowdown.dev/metodologia-elo',
        description: expect.stringContaining('ranking competitivo de AnimeShowdown'),
        image: '/img/stage/ranking.webp',
      }),
    )
  })
})
