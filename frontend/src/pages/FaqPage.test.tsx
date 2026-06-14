import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// useSeo: spy inspeccionable para asertar el contrato SEO real (no solo "no peta").
const seoSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSeo', () => ({ useSeo: seoSpy }))

// JsonLd espía: captura el schema recibido por id para asertar el contrato SEO
// (breadcrumbs + FAQPage) sin tocar document.head.
const jsonLd = vi.hoisted(() => ({
  calls: [] as Array<{ id?: string; schema: unknown }>,
}))
vi.mock('../components/JsonLd', () => ({
  default: ({ id, schema }: { id?: string; schema: unknown }) => {
    jsonLd.calls.push({ id, schema })
    return null
  },
}))

import FaqPage from './FaqPage'

// Las 10 preguntas + respuestas REALES (deben aparecer crawlables y ser
// idénticas a las del JSON-LD). Si alguien edita el copy, este array hay que
// actualizarlo a la vez — el test es el contrato.
const PREGUNTAS = [
  '¿Qué es AnimeShowdown?',
  '¿Cómo funciona el ranking competitivo?',
  '¿Qué son los torneos?',
  '¿Puedo crear mi propio torneo?',
  '¿Qué son las predicciones?',
  '¿Cómo veo el perfil de otros usuarios?',
  '¿AnimeShowdown es gratis?',
  '¿Quién está detrás del proyecto?',
  '¿Cómo añado un personaje que falta?',
  '¿Mis datos están seguros?',
]

const RESPUESTAS_FRAGMENTOS = [
  'Una plataforma para enfrentar a personajes de anime cara a cara.',
  'AnimeShowdown separa ELO base estimado y ranking comunitario.',
  'Brackets de 8 o 16 personajes a eliminación directa.',
  'Cualquier cuenta con email verificado puede crearlo desde /torneos/crear',
  'Mientras un torneo está activo puedes predecir quién avanzará',
  'Cada usuario tiene su perfil público en /u/su-nombre',
  'gratis y sin anuncios. Sin trackers de terceros',
  'AnimeShowdown es un proyecto independiente.',
  'Encontrarás un botón "Sugiere un personaje" en /personajes.',
  'La contraseña se guarda cifrada, puedes activar verificación en dos pasos',
]

function renderPage() {
  return render(
    <MemoryRouter>
      <FaqPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  jsonLd.calls.length = 0
  seoSpy.mockClear()
})

describe('FaqPage (las preguntas al maestro)', () => {
  it('renderiza el h1 "Preguntas frecuentes" (señal SEO preservada)', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Preguntas frecuentes' })).toBeInTheDocument()
  })

  it('pinta las 10 preguntas como texto crawlable (todas en el DOM, no solo la pestaña activa)', () => {
    const { container } = renderPage()
    // DOM-based: el texto de TODAS las preguntas está presente aunque su
    // tabpanel tenga [hidden] (las pestañas inactivas no se desmontan). Eso es
    // lo que ve el renderer de Google. (getByRole excluiría las ocultas.)
    const botones = [...container.querySelectorAll('.mf-q-btn')].map((b) => b.textContent?.trim())
    for (const q of PREGUNTAS) {
      expect(botones).toContain(q)
    }
    expect(botones).toHaveLength(PREGUNTAS.length)
  })

  it('mantiene las 10 respuestas en el DOM (crawlables aunque colapsadas/ocultas)', () => {
    const { container } = renderPage()
    // getByText es DOM-based: encuentra el texto aunque el tabpanel tenga [hidden]
    // o el acordeón esté plegado. Eso es justo lo que ve el renderer de Google.
    for (const frag of RESPUESTAS_FRAGMENTOS) {
      expect(
        screen.getByText((_t, node) => node?.textContent?.includes(frag) ?? false, {
          selector: '.mf-a p',
        }),
      ).toBeInTheDocument()
    }
    // Cada respuesta tiene su <div role="region"> aria-labelledby (acordeón a11y).
    expect(container.querySelectorAll('.mf-panel[role="region"]').length).toBe(PREGUNTAS.length)
  })

  it('emite el JsonLd de breadcrumbs (Inicio → FAQ) y el FAQPage', () => {
    renderPage()
    const ids = jsonLd.calls.map((c) => c.id)
    expect(ids).toContain('breadcrumbs')
    expect(ids).toContain('faq')

    const breadcrumbs = jsonLd.calls.find((c) => c.id === 'breadcrumbs')?.schema as {
      itemListElement: Array<{ name: string; item: string }>
    }
    expect(breadcrumbs.itemListElement.map((el) => el.name)).toEqual(['Inicio', 'FAQ'])
    expect(breadcrumbs.itemListElement.at(-1)?.item).toContain('/faq')
  })

  it('serializa el FAQPage con las 10 preguntas + respuestas IDÉNTICAS al render', () => {
    renderPage()
    const faq = jsonLd.calls.find((c) => c.id === 'faq')?.schema as {
      '@type': string
      mainEntity: Array<{
        '@type': string
        name: string
        acceptedAnswer: { '@type': string; text: string }
      }>
    }
    expect(faq['@type']).toBe('FAQPage')
    // Orden + texto de las preguntas idéntico al array fuente.
    expect(faq.mainEntity.map((q) => q.name)).toEqual(PREGUNTAS)
    expect(faq.mainEntity.map((q) => q.acceptedAnswer['@type'])).toEqual(
      PREGUNTAS.map(() => 'Answer'),
    )
    // El payload del rich snippet (las RESPUESTAS) está presente y, para cada
    // pregunta, su texto JSON-LD también está renderizado en la página → lo que
    // ve Google == lo que ve el usuario.
    expect(faq.mainEntity).toHaveLength(PREGUNTAS.length)
    for (const entry of faq.mainEntity) {
      const text = entry.acceptedAnswer.text
      expect(text.length).toBeGreaterThan(0)
      expect(
        screen.getByText((_t, node) => node?.textContent?.trim() === text, {
          selector: '.mf-a p',
        }),
      ).toBeInTheDocument()
    }
  })

  it('emite el SEO de la página (título + descripción; sin canonical/image custom)', () => {
    renderPage()
    expect(seoSpy).toHaveBeenCalledTimes(1)
    expect(seoSpy).toHaveBeenCalledWith({
      title: 'Preguntas frecuentes',
      description: expect.stringContaining('AnimeShowdown'),
    })
  })

  it('conserva los CTAs de contacto y los enlaces del pie', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:'),
    )
    expect(screen.getByRole('link', { name: /Reportar bug en GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/diegoalegil/AnimeShowdown/issues',
    )
    expect(screen.getByRole('link', { name: 'Catálogo de personajes' })).toHaveAttribute(
      'href',
      '/personajes',
    )
    expect(screen.getByRole('link', { name: 'Torneos activos' })).toHaveAttribute('href', '/torneos')
    expect(screen.getByRole('link', { name: 'Ranking ELO' })).toHaveAttribute('href', '/ranking')
  })

  it('filtra por búsqueda y resalta coincidencias sin mutar el texto', () => {
    const { container } = renderPage()
    const input = screen.getByLabelText('Buscar en preguntas y respuestas')
    // "predicciones" solo aparece en una pregunta/respuesta.
    fireEvent.change(input, { target: { value: 'predicciones' } })
    const botones = [...container.querySelectorAll('.mf-q-btn')].map((b) => b.textContent?.trim())
    // El texto sigue íntegro pese al <mark> que envuelve la coincidencia.
    expect(botones).toContain('¿Qué son las predicciones?')
    expect(botones).not.toContain('¿Qué es AnimeShowdown?')
    // La coincidencia se resalta en un <mark> (resaltado, no mutación).
    expect(container.querySelector('.mf-mark')?.textContent).toBe('predicciones')
    // El contador anuncia coincidencias (role=status).
    expect(screen.getByRole('status')).toHaveTextContent(/coincidencia/i)
  })
})
