import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnimesPage from './AnimesPage'

// ── Shell / SEO / chrome: fuera del SUT (igual que AnimesPage.test.tsx). ──
vi.mock('../hooks/useSeo', () => ({ useSeo: vi.fn() }))
vi.mock('../components/JsonLd', () => ({ default: () => null }))
vi.mock('../components/SugerirPersonajeCTA', () => ({ default: () => null }))
vi.mock('../data/visual-assets', () => ({
  BRAND_VISUALS: { animes: {}, empty: {} },
}))
vi.mock('../components/VisualSystem', () => ({
  VisualPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  // CinematicHero monta el ÚNICO <h1> de la página.
  CinematicHero: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
// Sonido: no-op (la Biblioteca usa useSoundOptional, pero lo silenciamos).
vi.mock('../contexts/SoundContext', () => ({
  useSoundOptional: () => ({ play: vi.fn(), warm: vi.fn(), muted: true, toggleMute: vi.fn() }),
}))
// Morph scene → hero: stub para no depender del motor de view-transitions.
// mountSceneCard (registro del tejuelo para el morph de VUELTA) devuelve su
// cleanup; el stub lo imita con un no-op para no tocar el motor real.
vi.mock('../lib/animeSceneMorph', () => ({
  markAnimeScene: vi.fn(),
  mountSceneCard: vi.fn(() => () => {}),
  mountSceneHero: vi.fn(() => () => {}),
}))
vi.mock('../components/AnimeSceneMorph', () => ({
  default: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))
// Retratos del top 3: stub (el test asserta texto/estado, no imágenes).
vi.mock('../components/PersonajeCutImg', () => ({ default: () => <span data-testid="portrait" /> }))

// Catálogo real-shaped: el SUT lo pasa por getAnimesCatalogo + derivarUniversos.
vi.mock('../hooks/usePersonajesCatalogo', () => ({
  usePersonajesCatalogo: () => ({
    personajes: [
      { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
      { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
      { slug: 'naruto', nombre: 'Naruto Uzumaki', anime: 'Naruto' },
      { slug: 'goku', nombre: 'Son Goku', anime: 'Dragon Ball' },
      { slug: 'tanjiro', nombre: 'Tanjiro Kamado', anime: 'Demon Slayer' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AnimesPage />
    </MemoryRouter>,
  )
}

describe('AnimesPage · Biblioteca de los universos', () => {
  afterEach(cleanup)

  it('renderiza un tomo (button aria-expanded) por universo del catálogo', () => {
    renderPage()
    // 4 universos: One Piece, Naruto, Dragon Ball, Demon Slayer.
    expect(screen.getByRole('button', { name: /One Piece/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('button', { name: /Naruto/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dragon Ball/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Demon Slayer/i })).toBeInTheDocument()
  })

  it('tiene un único h1', () => {
    renderPage()
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Universos anime')
  })

  it('al clicar un tomo abre su FlyLeaf (region) y Esc lo cierra devolviendo el foco', () => {
    vi.useFakeTimers()
    try {
      renderPage()
      const tomo = screen.getByRole('button', { name: /One Piece/i })
      fireEvent.click(tomo)

      expect(tomo).toHaveAttribute('aria-expanded', 'true')
      // El fly-leaf es un dialog (aria-modal): bottom-sheet en móvil, panel
      // anclado en escritorio, con contención de foco y Escape.
      const region = screen.getByRole('dialog', { name: /Universo One Piece/i })
      expect(region).toBeInTheDocument()
      // El CTA "entrar al universo" enlaza a la ficha del universo.
      expect(within(region).getByRole('link', { name: /entrar al universo/i })).toHaveAttribute(
        'href',
        '/animes/one-piece',
      )

      fireEvent.keyDown(document, { key: 'Escape' })
      // El colapso anima 250 ms (closingSlug); avanzamos el timer para que se
      // limpie, se desmonte la guarda y vuelva el foco al tomo.
      act(() => {
        vi.advanceTimersByTime(260)
      })
      expect(tomo).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('dialog', { name: /Universo One Piece/i })).not.toBeInTheDocument()
      expect(tomo).toHaveFocus()
    } finally {
      vi.useRealTimers()
    }
  })

  it('abrir otro tomo cierra el anterior primero (cola, sin solapar)', () => {
    vi.useFakeTimers()
    try {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /One Piece/i }))
      expect(screen.getByRole('dialog', { name: /Universo One Piece/i })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Naruto/i }))
      // One Piece entra en cola de cierre (sigue montado, animando el colapso);
      // Naruto aún NO está abierto: la cola no solapa.
      expect(
        screen.getByRole('dialog', { name: /Universo One Piece/i }),
      ).toHaveAttribute('data-closing', '1')
      expect(screen.queryByRole('dialog', { name: /Universo Naruto/i })).not.toBeInTheDocument()

      // Tras el colapso (250 ms), One Piece se desmonta y Naruto abre.
      act(() => {
        vi.advanceTimersByTime(260)
      })
      expect(screen.queryByRole('dialog', { name: /Universo One Piece/i })).not.toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: /Universo Naruto/i })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('teclear atenúa los no-coincidentes y anuncia el conteo (aria-live)', () => {
    renderPage()
    const buscador = screen.getByRole('searchbox', { name: /Buscar universo/i })
    fireEvent.change(buscador, { target: { value: 'naruto' } })

    // Conteo anunciado: 1 universo.
    expect(screen.getByText('1 universo')).toBeInTheDocument()

    // Naruto casa; One Piece no → su <li> queda data-match="0".
    const naruto = screen.getByRole('button', { name: /Naruto/i })
    const onePiece = screen.getByRole('button', { name: /One Piece/i })
    expect(naruto.closest('li')).toHaveAttribute('data-match', '1')
    expect(onePiece.closest('li')).toHaveAttribute('data-match', '0')
  })

  it('búsqueda sin resultados muestra la estantería vacía con kanji 空', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar universo/i }), {
      target: { value: 'zzzznada' },
    })
    // El kanji 空 y el título de estantería vacía: hay 2 role="status" (el
    // aria-live del conteo + la estantería vacía), así que asertamos por texto.
    const vacio = screen.getByText(/Estantería vacía/i).closest('.lib-empty')
    expect(vacio).toBeTruthy()
    expect(vacio).toHaveTextContent('空')
    expect(screen.getByText('0 universos')).toBeInTheDocument()
    // Ningún tomo se renderiza en la estantería vacía.
    expect(screen.queryByRole('button', { name: /One Piece/i })).not.toBeInTheDocument()
  })

  it('el orden es un radiogroup y cambiar de tablilla reordena (destacados→A–Z)', () => {
    renderPage()
    const grupo = screen.getByRole('radiogroup', { name: /Ordenar/i })
    const radios = within(grupo).getAllByRole('radio')
    // 5 tablillas = las 5 opciones de SORT_LABELS.
    expect(radios).toHaveLength(5)

    const az = within(grupo).getByRole('radio', { name: /A–Z/i })
    expect(az).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(az)
    expect(az).toHaveAttribute('aria-checked', 'true')

    // Tras A–Z, el primer tomo del DOM es alfabéticamente el primero.
    const tomos = screen.getAllByRole('button', { name: /(One Piece|Naruto|Dragon Ball|Demon Slayer)/i })
    expect(tomos[0]).toHaveTextContent('Demon Slayer')
  })

  it('el radiogroup implementa roving tabindex y flechas (patrón ARIA)', () => {
    renderPage()
    const grupo = screen.getByRole('radiogroup', { name: /Ordenar/i })
    const radios = within(grupo).getAllByRole('radio')
    // Roving tabindex: solo el activo (destacados, el primero) es tabbable.
    expect(radios[0]).toHaveAttribute('tabindex', '0')
    expect(radios[1]).toHaveAttribute('tabindex', '-1')

    // ArrowRight mueve la selección al siguiente y lo enfoca.
    radios[0].focus()
    fireEvent.keyDown(grupo, { key: 'ArrowRight' })
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('tabindex', '0')
    expect(radios[1]).toHaveFocus()

    // ArrowLeft retrocede de vuelta al primero…
    fireEvent.keyDown(grupo, { key: 'ArrowLeft' })
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[0]).toHaveFocus()

    // …y desde el primero (seleccionado) ArrowLeft hace wrap al último.
    fireEvent.keyDown(grupo, { key: 'ArrowLeft' })
    expect(radios[radios.length - 1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[radios.length - 1]).toHaveFocus()
  })

  it('la estantería con un tomo abierto lleva data-has-open=1 (no recorta el fly-leaf)', () => {
    vi.useFakeTimers()
    try {
      renderPage()
      const tomo = screen.getByRole('button', { name: /One Piece/i })
      const shelf = tomo.closest('.lib-shelf')
      expect(shelf).toHaveAttribute('data-has-open', '0')
      fireEvent.click(tomo)
      expect(shelf).toHaveAttribute('data-has-open', '1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('una búsqueda sin resultados cierra el tomo abierto (no reaparece al volver a casar)', () => {
    vi.useFakeTimers()
    try {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /One Piece/i }))
      expect(screen.getByRole('dialog', { name: /Universo One Piece/i })).toBeInTheDocument()

      const buscador = screen.getByRole('searchbox', { name: /Buscar universo/i })
      // Búsqueda sin resultados: sala vacía, el fly-leaf se desmonta…
      fireEvent.change(buscador, { target: { value: 'zzzznada' } })
      act(() => {
        vi.advanceTimersByTime(20)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // …y al volver a casar con One Piece el tomo NO reaparece abierto solo.
      fireEvent.change(buscador, { target: { value: 'one piece' } })
      act(() => {
        vi.advanceTimersByTime(20)
      })
      const reabierto = screen.getByRole('button', { name: /One Piece/i })
      expect(reabierto).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('AnimesPage · catálogo cargado pero vacío', () => {
  afterEach(cleanup)

  it('muestra un mensaje honesto cuando el catálogo carga sin universos', async () => {
    vi.resetModules()
    vi.doMock('../hooks/usePersonajesCatalogo', () => ({
      usePersonajesCatalogo: () => ({
        personajes: [],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }),
    }))
    const { default: AnimesPageVacio } = await import('./AnimesPage')
    render(
      <MemoryRouter>
        <AnimesPageVacio />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Aún no hay universos/i)).toBeInTheDocument()
    // La sala-biblioteca NO se monta (sin tomos) cuando el catálogo está vacío.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    vi.doUnmock('../hooks/usePersonajesCatalogo')
  })
})
