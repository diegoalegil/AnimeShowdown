import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import RequireCatalog from './RequireCatalog'

// Gate anti-regresión de V-2 ("blanco al navegar"): mientras el catálogo está
// pendiente, una ruta gated NUNCA debe pintar pantalla en blanco ni el spinner
// genérico — tiene que salir un <PageSkeleton> con la forma de la página.
// Este test es determinista (no depende de red ni de timings de Lighthouse):
// si alguien reintroduce un loader genérico o deja la ruta en blanco, falla.

type FakeQuery = {
  data?: unknown
  isPending: boolean
  isFetching: boolean
  isError: boolean
  refetch: () => void
}

function pendingQuery(overrides: Partial<FakeQuery> = {}): FakeQuery {
  return {
    data: undefined,
    isPending: true,
    isFetching: true,
    isError: false,
    refetch: () => {},
    ...overrides,
  }
}

describe('RequireCatalog — gate de catálogo (V-2 anti-blanco)', () => {
  afterEach(cleanup)

  it('con el catálogo pendiente pinta un skeleton con forma de página, no blanco ni spinner', () => {
    const { container, queryByText } = render(
      <RequireCatalog catalogoQuery={pendingQuery()} loadingPathname="/personajes">
        <div>contenido real de la página</div>
      </RequireCatalog>,
    )

    // 1) No filtra la página real mientras carga.
    expect(queryByText('contenido real de la página')).toBeNull()

    // 2) Hay un skeleton de página (no blanco): contenedor accesible
    //    role=status + aria-busy, como el viejo loader.
    const skeleton = container.querySelector('[data-page-skeleton]')
    expect(skeleton).not.toBeNull()
    expect(skeleton?.getAttribute('role')).toBe('status')
    expect(skeleton?.getAttribute('aria-busy')).toBe('true')

    // 3) La forma es ESPECÍFICA de la ruta (no un genérico): /personajes → grid.
    expect(skeleton?.getAttribute('data-page-skeleton')).toBe('catalogGrid')

    // 4) Tiene estructura real (varios bloques skeleton con la piel de marca
    //    .skl): ni spinner de un solo elemento ni página en blanco.
    expect(container.querySelectorAll('.skl').length).toBeGreaterThan(3)

    // 5) No es el spinner genérico que reemplazamos.
    expect(queryByText(/Preparando arena/i)).toBeNull()
  })

  it('adapta la forma del skeleton al pathname de la ruta', () => {
    const { container } = render(
      <RequireCatalog catalogoQuery={pendingQuery()} loadingPathname="/votar">
        <div>arena real</div>
      </RequireCatalog>,
    )
    expect(
      container.querySelector('[data-page-skeleton]')?.getAttribute('data-page-skeleton'),
    ).toBe('votar')
  })

  it('con el catálogo hidratado renderiza la página real (sin skeleton)', () => {
    const { container, queryByText } = render(
      <RequireCatalog
        catalogoQuery={pendingQuery({
          data: [{ slug: 'luffy' }],
          isPending: false,
          isFetching: false,
        })}
        loadingPathname="/personajes"
      >
        <div>contenido real de la página</div>
      </RequireCatalog>,
    )
    expect(queryByText('contenido real de la página')).not.toBeNull()
    expect(container.querySelector('[data-page-skeleton]')).toBeNull()
  })

  it('anuncia el error de catálogo como alert y usa tokens de botón existentes', () => {
    const refetch = vi.fn()
    render(
      <RequireCatalog
        catalogoQuery={pendingQuery({
          data: undefined,
          isPending: false,
          isFetching: false,
          isError: true,
          refetch,
        })}
      >
        <div>contenido real de la página</div>
      </RequireCatalog>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos cargar los personajes/i)

    const boton = screen.getByRole('button', { name: /Reintentar/i })
    expect(boton).toHaveClass('as-button-primary')
    expect(boton.className).not.toMatch(/bg-primary|primary-600/)

    fireEvent.click(boton)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('anuncia el catálogo vacío como status y usa tokens de botón existentes', () => {
    const refetch = vi.fn()
    render(
      <RequireCatalog
        catalogoQuery={pendingQuery({
          data: [],
          isPending: false,
          isFetching: false,
          refetch,
        })}
      >
        <div>contenido real de la página</div>
      </RequireCatalog>,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/Aún no hay personajes/i)

    const boton = screen.getByRole('button', { name: /Volver a comprobar/i })
    expect(boton).toHaveClass('as-button-primary')
    expect(boton.className).not.toMatch(/bg-primary|primary-600/)

    fireEvent.click(boton)
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
