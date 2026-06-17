import { describe, expect, it } from 'vitest'
import {
  KUMITE_STEPS,
  TOTAL_CORDONES,
  CEREMONIA_SELLO,
  esPasoValido,
  siguientePaso,
  kumiteCompleto,
  cordonesAnudados,
} from './kumite-core'

describe('kumite-core', () => {
  it('tiene 4 ejercicios con ids únicos, ordinales 1..4 y kanji con significado', () => {
    expect(KUMITE_STEPS).toHaveLength(4)
    expect(TOTAL_CORDONES).toBe(4)
    expect(KUMITE_STEPS.map((s) => s.id)).toEqual(['voto', 'empate', 'busqueda', 'archivo'])
    expect(KUMITE_STEPS.map((s) => s.ordinal)).toEqual([1, 2, 3, 4])
    // Cada paso explica su gesto en texto real (criterio a11y duro).
    for (const s of KUMITE_STEPS) {
      expect(s.kanji).toMatch(/[一-龯]/) // un kanji real
      expect(s.instruccion.length).toBeGreaterThan(10)
      expect(s.titulo).toBeTruthy()
    }
    expect(CEREMONIA_SELLO).toBe('誓')
  })

  it('esPasoValido distingue ids reales de ruido', () => {
    expect(esPasoValido('voto')).toBe(true)
    expect(esPasoValido('archivo')).toBe(true)
    expect(esPasoValido('inexistente')).toBe(false)
    expect(esPasoValido('')).toBe(false)
  })

  it('siguientePaso devuelve el primer pendiente en orden, null si completo', () => {
    expect(siguientePaso([])?.id).toBe('voto')
    expect(siguientePaso(['voto'])?.id).toBe('empate')
    expect(siguientePaso(['voto', 'empate'])?.id).toBe('busqueda')
    expect(siguientePaso(['voto', 'empate', 'busqueda'])?.id).toBe('archivo')
    expect(siguientePaso(['voto', 'empate', 'busqueda', 'archivo'])).toBeNull()
  })

  it('kumiteCompleto solo true con los 4 válidos; ignora ruido y duplicados', () => {
    expect(kumiteCompleto([])).toBe(false)
    expect(kumiteCompleto(['voto', 'empate', 'busqueda'])).toBe(false)
    expect(kumiteCompleto(['voto', 'empate', 'busqueda', 'archivo'])).toBe(true)
    // Ruido/duplicados no completan ni rompen.
    expect(kumiteCompleto(['voto', 'voto', 'empate', 'busqueda', 'basura'])).toBe(false)
    expect(kumiteCompleto(['voto', 'empate', 'busqueda', 'archivo', 'archivo', 'x'])).toBe(true)
  })

  it('cordonesAnudados cuenta válidos saturando a 4', () => {
    expect(cordonesAnudados([])).toBe(0)
    expect(cordonesAnudados(['voto', 'busqueda'])).toBe(2)
    expect(cordonesAnudados(['voto', 'voto', 'basura'])).toBe(1)
    expect(cordonesAnudados(['voto', 'empate', 'busqueda', 'archivo', 'extra'])).toBe(4)
  })
})
