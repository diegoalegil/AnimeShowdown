import { describe, expect, it } from 'vitest'
import { contarTorneosEnVivo, contarTorneosProgramados } from './hearth-hero-core'

describe('contarTorneosEnVivo', () => {
  it('devuelve null mientras la query no resolvió', () => {
    expect(contarTorneosEnVivo(undefined)).toBeNull()
  })

  it('cuenta solo IN_PROGRESS', () => {
    expect(
      contarTorneosEnVivo([
        { estado: 'IN_PROGRESS' },
        { estado: 'SCHEDULED' },
        { estado: 'IN_PROGRESS' },
        { estado: 'FINISHED' },
        {},
      ]),
    ).toBe(2)
  })

  it('lista vacía es 0 (estado "enciende tú el primero")', () => {
    expect(contarTorneosEnVivo([])).toBe(0)
  })
})

describe('contarTorneosProgramados', () => {
  it('devuelve null mientras la query no resolvió', () => {
    expect(contarTorneosProgramados(null)).toBeNull()
  })

  it('cuenta solo SCHEDULED (el segundo nivel del vacío)', () => {
    expect(
      contarTorneosProgramados([
        { estado: 'IN_PROGRESS' },
        { estado: 'SCHEDULED' },
        { estado: 'SCHEDULED' },
        { estado: 'FINISHED' },
      ]),
    ).toBe(2)
  })
})
