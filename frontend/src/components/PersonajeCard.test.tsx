import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PersonajeCard from './PersonajeCard'

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
}))

vi.mock('./PersonajeImg', () => ({
  default: ({
    className,
    colorDominante,
    src,
  }: {
    className?: string
    colorDominante?: string
    src?: string
  }) => (
    <span
      data-testid="personaje-img"
      data-color-dominante={colorDominante}
      data-src={src}
      className={className}
    />
  ),
}))

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('hover: hover') || query.includes('pointer: fine'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('PersonajeCard', () => {
  it('mantiene estable el nodo de la carta al hacer hover', () => {
    const { container } = render(
      <MemoryRouter>
        <PersonajeCard
          slug="naruto-uzumaki"
          nombre="Naruto Uzumaki"
          anime="Naruto"
          rank={1}
        />
      </MemoryRouter>,
    )

    const link = container.querySelector('a[href="/personajes/naruto-uzumaki"]')
    const articleBefore = link?.querySelector('article')

    expect(link).not.toBeNull()
    expect(articleBefore).not.toBeNull()

    fireEvent.mouseEnter(link as Element)

    expect(
      container.querySelector('a[href="/personajes/naruto-uzumaki"] article'),
    ).toBe(articleBefore)
  })

  it('usa el color dominante del personaje como fondo de la imagen', () => {
    // Algunos artes son recortes transparentes, así que el fondo se ve.
    // Pasamos el color real
    // del catálogo (viaja en el spread {...p}) en vez de forzar surface.
    render(
      <MemoryRouter>
        <PersonajeCard
          slug="naruto-uzumaki"
          nombre="Naruto Uzumaki"
          anime="Naruto"
          rank={1}
          imagenColorDominante="var(--demo-color-dominante)"
        />
      </MemoryRouter>,
    )

    const media = screen.getByTestId('personaje-img')
    expect(media).toHaveAttribute('data-color-dominante', 'var(--demo-color-dominante)')
  })

  it('usa la imagen recibida por DTO sin esperar al catalogo global', () => {
    render(
      <MemoryRouter>
        <PersonajeCard
          slug="naruto-uzumaki"
          nombre="Naruto Uzumaki"
          anime="Naruto"
          rank={1}
          imagen="/img/Naruto/naruto-fallback.webp"
          imagenUrl="/img/Naruto/naruto.webp"
        />
      </MemoryRouter>,
    )

    const media = screen.getByTestId('personaje-img')
    expect(media).toHaveAttribute('data-src', '/img/Naruto/naruto.webp')
  })

  it('cae a surface cuando el personaje no trae color dominante', () => {
    render(
      <MemoryRouter>
        <PersonajeCard
          slug="naruto-uzumaki"
          nombre="Naruto Uzumaki"
          anime="Naruto"
          rank={1}
        />
      </MemoryRouter>,
    )

    const media = screen.getByTestId('personaje-img')
    expect(media).toHaveAttribute('data-color-dominante', 'var(--color-surface)')
  })

  it('no escala la imagen en hover (sin flash de color en hover)', () => {
    render(
      <MemoryRouter>
        <PersonajeCard
          slug="naruto-uzumaki"
          nombre="Naruto Uzumaki"
          anime="Naruto"
          rank={1}
        />
      </MemoryRouter>,
    )

    const media = screen.getByTestId('personaje-img')
    expect(media.className).not.toContain('group-hover:scale')
  })

  it('no usa content-visibility en el listado interactivo de personajes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/PersonajesPage.jsx'),
      'utf8',
    )

    expect(source).not.toContain('[&>*]:[content-visibility:auto]')
  })

  it('el documento garantiza lienzo oscuro bajo content-visibility (anti pantalla blanca)', () => {
    // Contrato del fix de "pantallas en blanco al hacer scroll rápido":
    // content-visibility por card SOLO es seguro si los tiles sin rasterizar
    // del fling se rellenan de oscuro. Eso exige background-color SÓLIDO en
    // html (el shorthand `background:` lo dejaba transparent → tiles blancos)
    // y color-scheme dark declarado en la raíz del documento.
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const htmlRule = css.match(/\n  html \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(htmlRule).toContain('background-color: #04070c')
    const rootRule = css.match(/\n  :root \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(rootRule).toContain('color-scheme: dark')

    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain('<meta name="color-scheme" content="dark" />')
  })
})
