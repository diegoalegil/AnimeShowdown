import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import CartasPage from './CartasPage'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'diegofutbolista1' } }),
}))

vi.mock('../hooks/useCartas', () => ({
  useColeccion: () => ({
    data: {
      saldo: 70,
      totalCatalogo: 1138,
      totalPoseidas: 0,
      porcentaje: 0,
      cartas: [],
      progresoPorAnime: [],
      pityActual: 0,
      pityDuro: 10,
      cofreDiarioDisponible: true,
    },
    isLoading: false,
    isError: false,
  }),
  useOddsCartas: () => ({
    data: {
      precioSobre: 100,
      normalesPorSobre: 4,
      pityDuro: 10,
      probabilidadEspecialBase: 0.05,
    },
  }),
  useSobresGratis: () => ({ data: [], isLoading: false, isError: false }),
  useAbrirSobre: () => ({
    isPending: false,
    isError: false,
    mutateAsync: () => Promise.resolve({}),
  }),
  useAbrirSobreGratis: () => ({
    isPending: false,
    isError: false,
    mutateAsync: () => Promise.resolve({}),
  }),
  useCofreDiario: () => ({
    isPending: false,
    isError: false,
    mutateAsync: () => Promise.resolve({}),
  }),
  useDescargarCarta: () => ({
    isPending: false,
    isError: false,
    variables: null,
    mutate: () => {},
  }),
}))

vi.mock('../features/cartas/PackOpening', () => ({
  default: () => <div>Pack opening</div>,
}))

afterEach(() => cleanup())

describe('CartasPage', () => {
  it('explica de forma visible como se consiguen las monedas', () => {
    render(
      <MemoryRouter>
        <CartasPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /cómo conseguir monedas/i })).toBeInTheDocument()
    expect(screen.getByText('Reclama el cofre diario desde esta página.')).toBeInTheDocument()
    expect(screen.getByText(/el primer voto completa la misión diaria/i)).toBeInTheDocument()
    expect(screen.getByText('Gana duelos live y acierta predicciones de torneos.')).toBeInTheDocument()
    expect(screen.getByText('Las cartas repetidas devuelven monedas automáticamente.')).toBeInTheDocument()
  })
})
