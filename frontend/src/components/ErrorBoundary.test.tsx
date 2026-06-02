import { useEffect, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function StatefulPage({ onMount }: { onMount: () => void }) {
  const [value, setValue] = useState('inicial')

  useEffect(() => {
    onMount()
  }, [onMount])

  return (
    <label>
      Estado local
      <input
        aria-label="estado local"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  )
}

function MaybeCrash({ crash }: { crash: boolean }) {
  if (crash) throw new Error('fallo de ruta')
  return <p>Ruta recuperada</p>
}

describe('ErrorBoundary resetKey', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('no remonta hijos al navegar si no hay error activo', () => {
    const onMount = vi.fn()
    const { rerender } = render(
      <ErrorBoundary resetKey="/mi-top5">
        <StatefulPage onMount={onMount} />
      </ErrorBoundary>,
    )

    fireEvent.change(screen.getByLabelText('estado local'), {
      target: { value: 'ranking propio' },
    })

    rerender(
      <ErrorBoundary resetKey="/animes/one-piece">
        <StatefulPage onMount={onMount} />
      </ErrorBoundary>,
    )

    expect(screen.getByLabelText('estado local')).toHaveValue('ranking propio')
    expect(onMount).toHaveBeenCalledTimes(1)
  })

  it('resetea el fallback al cambiar de ruta tras un error', async () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/ruta-rota">
        <MaybeCrash crash />
      </ErrorBoundary>,
    )

    expect(screen.getByText('La batalla se ha interrumpido')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="/ruta-sana">
        <MaybeCrash crash={false} />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByText('Ruta recuperada')).toBeInTheDocument()
    })
  })
})
