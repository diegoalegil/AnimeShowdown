import { describe, expect, it, vi } from 'vitest'
import { crearRetencion } from './cuentaRetenida.js'

describe('crearRetencion', () => {
  it('congela la cuenta hasta soltarla y avisa solo al cambiar', () => {
    const r = crearRetencion()
    const oyente = vi.fn()
    r.subscribe(oyente)
    expect(r.getSnapshot()).toBe(null)
    r.retener(12)
    r.retener(15)
    expect(r.getSnapshot()).toBe(12)
    r.soltar()
    r.soltar()
    expect(r.getSnapshot()).toBe(null)
    expect(oyente).toHaveBeenCalledTimes(2)
  })
})
