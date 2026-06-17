import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TrainingKumite from './TrainingKumite'

// useSoundOptional es tolerante fuera de SoundProvider (no-op) y framer
// useReducedMotion lee matchMedia (happy-dom → false): el kumite renderiza sin
// providers. PersonajeImg pinta sin red. Aserciones = DOM/flujo, no animación.

const P = (slug: string, nombre: string, anime: string) => ({ slug, nombre, anime })
const props = () => ({
  izquierda: P('luffy', 'Luffy', 'One Piece'),
  derecha: P('zoro', 'Zoro', 'One Piece'),
  objetivo: P('nami', 'Nami', 'One Piece'),
})

afterEach(cleanup)

describe('TrainingKumite', () => {
  it('completa los 4 ejercicios con teclado/click y llama onComplete UNA vez', () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      render(<TrainingKumite {...props()} onComplete={onComplete} onSkip={vi.fn()} />)

      // Ej.1 EL VOTO: tocar una carta.
      fireEvent.click(screen.getByRole('button', { name: /Votar por Luffy/i }))
      // Ej.2 EL EMPATE: la balanza.
      fireEvent.click(screen.getByRole('button', { name: /Declarar empate/i }))
      // Ej.3 LA BÚSQUEDA: abrir, escribir 2 letras del objetivo, elegirlo.
      fireEvent.click(screen.getByRole('button', { name: /Abrir el buscador/i }))
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'na' } })
      fireEvent.click(screen.getByRole('button', { name: /Nami/i }))
      // Ej.4 EL ARCHIVO.
      fireEvent.click(screen.getByRole('button', { name: /Entendido/i }))

      // Ceremonia del cinturón visible.
      expect(screen.getByText(/Cinturón completo/i)).toBeTruthy()

      // onComplete tras la ceremonia, y SOLO una vez (guard one-shot).
      vi.advanceTimersByTime(2500)
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('"Ya entrené" salta el kumite (onSkip) sin completar', () => {
    const onComplete = vi.fn()
    const onSkip = vi.fn()
    render(<TrainingKumite {...props()} onComplete={onComplete} onSkip={onSkip} />)

    fireEvent.click(screen.getByRole('button', { name: /Ya entrené/i }))

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('arranca en el ejercicio 1 (el voto) con las cartas votables', () => {
    render(<TrainingKumite {...props()} onComplete={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Votar por Luffy/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Votar por Zoro/i })).toBeTruthy()
    // La balanza existe pero deshabilitada en el ejercicio del voto.
    expect(screen.getByRole('button', { name: /Declarar empate/i })).toHaveProperty('disabled', true)
  })
})
