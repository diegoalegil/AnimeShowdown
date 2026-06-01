import { Suspense } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lazyRoute } from './lazyRoute'
import {
  recoverFromStaleAssetError,
} from './staleAssetRecovery'

vi.mock('./staleAssetRecovery', () => ({
  isStaleAssetError: vi.fn((error: unknown) => {
    const maybeError = error as { message?: unknown } | null
    const message = String(maybeError?.message ?? error).toLowerCase()
    return (
      message.includes('failed to fetch dynamically imported module') ||
      message.includes("cannot read properties of undefined (reading 'default')")
    )
  }),
  recoverFromStaleAssetError: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('lazyRoute', () => {
  it('muestra recuperacion stale-aware cuando falla un chunk lazy', async () => {
    const BrokenRoute = lazyRoute(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    )

    render(
      <Suspense fallback={<div>Cargando ruta...</div>}>
        <BrokenRoute />
      </Suspense>,
    )

    expect(screen.getByText('Cargando ruta...')).toBeInTheDocument()
    expect(await screen.findByText('Actualiza esta pantalla')).toBeInTheDocument()
    expect(screen.queryByText('Cargando ruta...')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveAttribute('data-stale-route-recovery', 'true')
    expect(recoverFromStaleAssetError).toHaveBeenCalledTimes(1)
  })

  it('no deja Suspense colgado si el modulo lazy llega sin default', async () => {
    const BrokenRoute = lazyRoute(() => Promise.resolve({ named: () => null }))

    render(
      <Suspense fallback={<div>Cargando ruta...</div>}>
        <BrokenRoute />
      </Suspense>,
    )

    expect(await screen.findByText('Actualiza esta pantalla')).toBeInTheDocument()
    expect(screen.queryByText('Cargando ruta...')).not.toBeInTheDocument()
    expect(recoverFromStaleAssetError).toHaveBeenCalledTimes(1)
  })
})
