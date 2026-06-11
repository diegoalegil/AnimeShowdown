import { describe, expect, it } from 'vitest'

import {
  MAX_ANIMATED_CHANGES_PER_CYCLE,
  trackLiveChange,
} from './live-burst-gate'

const nextMicrotask = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve)
  })

describe('trackLiveChange', () => {
  it('acumula los cambios del mismo ciclo en un contador compartido', () => {
    const primero = trackLiveChange()
    for (let i = 0; i < MAX_ANIMATED_CHANGES_PER_CYCLE; i += 1) {
      trackLiveChange()
    }
    // Todos los registros comparten el objeto del ciclo: el total queda
    // visible para cualquiera que decida tras un microtask.
    expect(primero.count).toBe(MAX_ANIMATED_CHANGES_PER_CYCLE + 1)
    expect(primero.count).toBeGreaterThan(MAX_ANIMATED_CHANGES_PER_CYCLE)
  })

  it('cierra el ciclo por microtask: el siguiente cambio abre uno nuevo', async () => {
    const masivo = trackLiveChange()
    trackLiveChange()
    await nextMicrotask()
    const suelto = trackLiveChange()
    expect(suelto).not.toBe(masivo)
    expect(suelto.count).toBe(1)
    expect(masivo.count).toBe(2)
  })
})
