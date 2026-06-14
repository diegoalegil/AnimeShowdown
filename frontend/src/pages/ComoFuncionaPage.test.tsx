import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// useSeo: spy inspeccionable para asertar el contrato SEO real (no solo "no peta").
const seoSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSeo', () => ({ useSeo: seoSpy }))

// VisualPageShell deja pasar los children (sin canvas/atmósfera en test).
vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../data/visual-assets', () => ({
  BRAND_VISUALS: { home: { image: '/img/stage/home-hero.webp' } },
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

import ComoFuncionaPage from './ComoFuncionaPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ComoFuncionaPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  jsonLd.calls.length = 0
  seoSpy.mockClear()
})

describe('ComoFuncionaPage (manga storyboard)', () => {
  it('pinta las 5 viñetas con el copy real de los 4 pasos + la misión diaria', () => {
    renderPage()
    // Eyebrows de los 4 pasos (orden preservado).
    expect(screen.getByText('1. Vota')).toBeInTheDocument()
    expect(screen.getByText('2. Juega')).toBeInTheDocument()
    expect(screen.getByText('3. Mira ranking')).toBeInTheDocument()
    expect(screen.getByText('4. Guarda progreso')).toBeInTheDocument()
    // Líneas reales de cada paso.
    expect(screen.getByText('Elige ganador en duelos cara a cara.')).toBeInTheDocument()
    expect(screen.getByText('Completa Shadow Guess, AniGrid o Impostor Trial.')).toBeInTheDocument()
    expect(screen.getByText('Revisa qué personajes suben, caen o dominan.')).toBeInTheDocument()
    expect(
      screen.getByText('Crea cuenta cuando quieras historial, racha y logros.'),
    ).toBeInTheDocument()
    // Viñeta 5 — la misión diaria + su párrafo largo.
    expect(screen.getByText('La misión diaria')).toBeInTheDocument()
    expect(screen.getByText(/La primera versión del loop diario vive en tu navegador/i)).toBeInTheDocument()
  })

  it('estructura el artículo como cinco viñetas koma', () => {
    const { container } = renderPage()
    expect(
      screen.getByLabelText('Cómo funciona AnimeShowdown, en cinco viñetas'),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('.manga-koma')).toHaveLength(5)
  })

  it('conserva los cuatro CTAs emparejando label → destino', () => {
    renderPage()
    // Atamos cada texto visible a su href: un toContain de hrefs sueltos dejaba
    // pasar cruces (label↔destino) y el '/votar' duplicado del bocadillo
    // enmascaraba la pérdida del CTA primario "Completar votos".
    const ctas: Array<[string, string]> = [
      ['Completar votos', '/votar'],
      ['Jugar daily', '/games'],
      ['Ver ranking', '/ranking'],
      ['Entender metodología', '/metodologia-elo'],
    ]
    for (const [label, href] of ctas) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('mantiene el grito final ¡A LA ARENA! enlazando a /votar', () => {
    renderPage()
    const bubble = screen.getByRole('link', { name: '¡A la arena! Empezar votando' })
    expect(bubble).toHaveAttribute('href', '/votar')
    expect(screen.getByText('¡A LA ARENA!')).toBeInTheDocument()
  })

  it('emite el JsonLd de breadcrumbs y el FAQPage con las 3 preguntas', () => {
    renderPage()
    const ids = jsonLd.calls.map((c) => c.id)
    expect(ids).toContain('breadcrumbs')
    expect(ids).toContain('faq-como-funciona')

    const breadcrumbs = jsonLd.calls.find((c) => c.id === 'breadcrumbs')?.schema as {
      itemListElement: Array<{ name: string }>
    }
    expect(breadcrumbs.itemListElement.map((el) => el.name)).toEqual([
      'Inicio',
      'Cómo funciona',
    ])

    const faq = jsonLd.calls.find((c) => c.id === 'faq-como-funciona')?.schema as {
      '@type': string
      mainEntity: Array<{ name: string; acceptedAnswer: { '@type': string; text: string } }>
    }
    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity.map((q) => q.name)).toEqual([
      '¿Qué es AnimeShowdown?',
      '¿Necesito cuenta para votar?',
      '¿Qué puedo hacer cada día?',
    ])
    // El payload SEO del rich snippet son las RESPUESTAS, no solo los títulos.
    expect(faq.mainEntity.map((q) => q.acceptedAnswer['@type'])).toEqual(['Answer', 'Answer', 'Answer'])
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual([
      'AnimeShowdown es una plataforma para votar duelos de personajes de anime, jugar retos diarios y ver rankings competitivos creados por la comunidad.',
      'Puedes probar varios votos como invitado. Crear cuenta sirve para guardar historial, rachas, logros y proteger mejor el ranking.',
      'Completar la misión diaria: votar duelos, jugar un daily trial y revisar cómo se mueve el ranking.',
    ])
  })

  it('emite el SEO de la página (título, descripción, canonical, image)', () => {
    renderPage()
    expect(seoSpy).toHaveBeenCalledTimes(1)
    expect(seoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cómo funciona',
        canonical: 'https://animeshowdown.dev/como-funciona',
        description: expect.stringContaining('AnimeShowdown'),
        image: '/img/stage/home-hero.webp',
      }),
    )
  })
})
