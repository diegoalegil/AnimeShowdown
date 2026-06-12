import { describe, expect, it } from 'vitest'
import { contarTorneosEnVivo, sumarVotosComunidad } from './hearth-hero-core'

describe('sumarVotosComunidad', () => {
  it('devuelve null mientras la query no resolvió (undefined/null)', () => {
    expect(sumarVotosComunidad(undefined)).toBeNull()
    expect(sumarVotosComunidad(null)).toBeNull()
  })

  it('suma los votos del ranking ignorando entradas sin campo', () => {
    expect(
      sumarVotosComunidad([
        { votos: 1200 },
        { votos: 34 },
        {},
        { votos: null },
      ]),
    ).toBe(1234)
  })

  it('ranking vacío (DB joven) es 0 honesto, no null', () => {
    expect(sumarVotosComunidad([])).toBe(0)
  })

  it('tolera votos no numéricos sin propagar NaN', () => {
    expect(sumarVotosComunidad([{ votos: 10 }, { votos: 'x' as never }])).toBe(10)
  })
})

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
