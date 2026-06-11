import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import PersonajeImg from './PersonajeImg'

vi.mock('../lib/personajes-core', () => ({
  CATALOGO_PERSONAJES_HYDRATED_EVENT: 'catalog-hydrated',
  MISSING_IMAGE_PREFIX: '/img/_missing/',
  getPersonajeBySlug: (slug: string) => ({
    slug,
    nombre: 'Monkey D. Luffy',
    anime: 'One Piece',
    imagenColorDominante: 'var(--color-surface)',
  }),
  imagenPersonaje: (slug: string) => `/img/One_Piece/${slug}.webp`,
}))

vi.mock('../lib/asset-tracking', () => ({
  trackAssetError: vi.fn(),
}))

afterEach(() => cleanup())

describe('PersonajeImg', () => {
  it('capa el srcset responsive a 600w por defecto', () => {
    const { container } = render(
      <PersonajeImg
        slug="luffy"
        src="/img/One_Piece/luffy.webp"
        alt="Monkey D. Luffy"
      />,
    )

    const source = container.querySelector('source[type="image/webp"]')
    const srcSet = source?.getAttribute('srcset')

    expect(srcSet).toContain('/img/One_Piece/luffy-300.webp 300w')
    expect(srcSet).toContain('/img/One_Piece/luffy-600.webp 600w')
    expect(srcSet).not.toContain('/img/One_Piece/luffy.webp 1024w')
  })

  it('permite el original solo en superficies grandes explicitas', () => {
    const { container } = render(
      <PersonajeImg
        slug="luffy"
        src="/img/One_Piece/luffy.webp"
        alt="Monkey D. Luffy"
        maxSourceWidth={1024}
      />,
    )

    expect(container.querySelector('source')?.getAttribute('srcset')).toContain(
      '/img/One_Piece/luffy.webp 1024w',
    )
  })

  it('no compone variantes dobles si recibe una URL ya reducida', () => {
    const { container } = render(
      <PersonajeImg
        slug="luffy"
        src="/img/One_Piece/luffy-600.webp?v=1"
        alt="Monkey D. Luffy"
      />,
    )

    const srcSet = container.querySelector('source')?.getAttribute('srcset')

    expect(srcSet).toContain('/img/One_Piece/luffy-300.webp?v=1 300w')
    expect(srcSet).toContain('/img/One_Piece/luffy-600.webp?v=1 600w')
    expect(srcSet).not.toContain('luffy-600-300')
  })

  // Contrato V-5: la visibilidad de la imagen NUNCA depende del load-event.
  // En Safari, con lazy + content-visibility, el evento puede perderse; un
  // gate opacity-0 dejaba la carta atascada en el color dominante (sintoma
  // real de prod). El fade es CSS (.as-img-reveal) y solo cosmetico.
  it('nunca gatea la visibilidad con opacity-0 a la espera del load-event', () => {
    render(
      <PersonajeImg
        slug="nami"
        src="/img/One_Piece/nami.webp"
        alt="Nami"
      />,
    )

    const img = screen.getByRole('img', { name: 'Nami' })

    expect(img.className).not.toContain('opacity-0')
    expect(img.className).toContain('as-img-reveal')
  })

  it('no re-aplica el fade al remontar un src ya cargado (anti-parpadeo V-4)', () => {
    const { unmount } = render(
      <PersonajeImg
        slug="zoro"
        src="/img/One_Piece/zoro.webp"
        alt="Roronoa Zoro"
      />,
    )

    fireEvent.load(screen.getByRole('img', { name: 'Roronoa Zoro' }))
    unmount()

    render(
      <PersonajeImg
        slug="zoro"
        src="/img/One_Piece/zoro.webp"
        alt="Roronoa Zoro"
      />,
    )

    const img = screen.getByRole('img', { name: 'Roronoa Zoro' })

    expect(img.className).not.toContain('as-img-reveal')
    expect(img.className).not.toContain('opacity-0')
  })

  it('acepta politica de encuadre sin depender de clases del contenedor', () => {
    render(
      <PersonajeImg
        slug="luffy"
        src="/img/One_Piece/luffy.webp"
        alt="Monkey D. Luffy"
        fit="contain"
        position="center"
        className="h-full w-full object-cover object-top"
      />,
    )

    const img = screen.getByRole('img', { name: 'Monkey D. Luffy' })

    expect(img.className).toContain('object-contain')
    expect(img.className).toContain('object-center')
  })
})
