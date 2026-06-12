import { describe, expect, it } from 'vitest'
import {
  buildDuelVoteUrl,
  sumarVotosComunidad,
  UMBRAL_COMUNIDAD_JOVEN,
} from './pulso-utils'

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

  it('tolera votos no numéricos y entradas null sin propagar NaN', () => {
    expect(
      sumarVotosComunidad([{ votos: 10 }, { votos: 'x' as never }, null as never]),
    ).toBe(10)
  })
})

describe('UMBRAL_COMUNIDAD_JOVEN', () => {
  it('está pinneado: el disclaimer del Pulso y el copy de arranque del hogar comparten criterio', () => {
    expect(UMBRAL_COMUNIDAD_JOVEN).toBe(30)
  })
})

describe('buildDuelVoteUrl', () => {
  it('compone la URL del duelo con ambos slugs', () => {
    expect(buildDuelVoteUrl({ slug: 'a' }, { slug: 'b' })).toBe(
      '/votar?personaje=a&rival=b',
    )
  })

  it('cae a /votar sin slugs completos', () => {
    expect(buildDuelVoteUrl({ slug: 'a' }, null)).toBe('/votar')
  })
})
