import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  toast,
  getSnapshot,
  setMaxVisible,
  setMotionOff,
} from './dispatch-toast-store'

// El store es un singleton de módulo (como sonner): se limpia entre tests.
afterEach(() => {
  vi.useFakeTimers()
  toast.dismiss() // clearAll
  vi.runOnlyPendingTimers() // vacía las tiras salientes
  vi.useRealTimers()
})

describe('dispatch-toast-store (compat sonner)', () => {
  it('expone toda la API de sonner usada en el repo, incluido message', () => {
    // Regresión: toast.message faltaba y ComentariosPersonaje lo usa → TypeError.
    for (const m of ['success', 'error', 'info', 'message', 'achievement', 'dismiss']) {
      expect(typeof (toast as Record<string, unknown>)[m]).toBe('function')
    }
    expect(typeof toast).toBe('function')
  })

  it('toast.message crea un parte neutro (info) sin lanzar', () => {
    expect(() => toast.message('Comentario enviado a revisión')).not.toThrow()
    const ultimo = getSnapshot().active.at(-1)
    expect(ultimo?.type).toBe('info')
  })

  it('respeta el invariante FIFO ≤ maxVisible (incluye salientes)', () => {
    vi.useFakeTimers()
    setMotionOff(true)
    setMaxVisible(3)
    toast.dismiss()
    vi.runOnlyPendingTimers()
    ;['1', '2', '3', '4'].forEach((m) => toast.success(m))
    const snap = getSnapshot()
    expect(snap.active.length).toBeLessThanOrEqual(3)
    expect(snap.queue.length).toBeGreaterThanOrEqual(1)
    vi.useRealTimers()
  })
})
