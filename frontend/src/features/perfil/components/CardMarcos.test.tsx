import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return {
    ApiError,
    updateUser: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    endpoints: {
      misMarcos: vi.fn(),
      comprarMarco: vi.fn(),
      equiparMarco: vi.fn(),
    },
  }
})

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'goku' }, updateUser: h.updateUser }),
}))
vi.mock('../../../lib/api', () => ({ endpoints: h.endpoints, ApiError: h.ApiError }))

import CardMarcos from './CardMarcos'

const ESTADO = {
  saldo: 700,
  equipado: null,
  marcos: [
    { id: 'oro', nombre: 'Marco Oro', descripcion: 'Dorado', precio: 600, rareza: 'RARO', estilo: 'ring-oro', poseido: false, equipado: false },
    { id: 'prismatico', nombre: 'Halo Prismático', descripcion: 'Legendario', precio: 3000, rareza: 'LEGENDARIO', estilo: 'aura-prismatico', poseido: false, equipado: false },
    { id: 'plata', nombre: 'Marco Plata', descripcion: 'Plateado', precio: 300, rareza: 'COMUN', estilo: 'ring-plata', poseido: true, equipado: false },
  ],
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CardMarcos />
    </QueryClientProvider>,
  )
}

describe('CardMarcos', () => {
  beforeEach(() => {
    h.updateUser.mockReset()
    h.toast.success.mockReset()
    h.toast.error.mockReset()
    h.endpoints.misMarcos.mockReset().mockResolvedValue(ESTADO)
    h.endpoints.comprarMarco.mockReset()
    h.endpoints.equiparMarco.mockReset()
  })
  afterEach(() => cleanup())

  it('pinta el catálogo con saldo, precios y estados', async () => {
    renderCard()
    expect(await screen.findByText('Marco Oro')).toBeInTheDocument()
    // Comprable (saldo 700 >= 600).
    expect(screen.getByRole('button', { name: /Comprar · 600/i })).toBeEnabled()
    // No alcanza el legendario (3000): muestra cuánto falta y queda deshabilitado.
    const caro = screen.getByRole('button', { name: /Faltan 2300/i })
    expect(caro).toBeDisabled()
    // Poseído pero no equipado -> Equipar.
    expect(screen.getByRole('button', { name: /^Equipar$/i })).toBeInTheDocument()
  })

  it('compra un marco: debita, refleja estado y avisa', async () => {
    h.endpoints.comprarMarco.mockResolvedValue({
      ...ESTADO,
      saldo: 100,
      marcos: ESTADO.marcos.map((m) => (m.id === 'oro' ? { ...m, poseido: true } : m)),
    })
    renderCard()
    fireEvent.click(await screen.findByRole('button', { name: /Comprar · 600/i }))
    await waitFor(() => expect(h.endpoints.comprarMarco).toHaveBeenCalledWith('oro'))
    expect(h.toast.success).toHaveBeenCalled()
    expect(h.updateUser).toHaveBeenCalledWith({ marcoAvatar: null })
  })

  it('equipa un marco poseído y propaga el aro al usuario', async () => {
    h.endpoints.equiparMarco.mockResolvedValue({ ...ESTADO, equipado: 'plata' })
    renderCard()
    fireEvent.click(await screen.findByRole('button', { name: /^Equipar$/i }))
    await waitFor(() => expect(h.endpoints.equiparMarco).toHaveBeenCalledWith('plata'))
    expect(h.updateUser).toHaveBeenCalledWith({ marcoAvatar: 'plata' })
  })

  it('ante un error de compra muestra toast.error', async () => {
    h.endpoints.comprarMarco.mockRejectedValue(new h.ApiError('Saldo insuficiente', 409))
    renderCard()
    fireEvent.click(await screen.findByRole('button', { name: /Comprar · 600/i }))
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled())
    expect(h.updateUser).not.toHaveBeenCalled()
  })
})
