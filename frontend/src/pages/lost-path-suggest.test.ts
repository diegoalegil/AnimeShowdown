import { describe, expect, it } from 'vitest'

import {
  extractPersonajeSlug,
  levenshtein,
  suggestPersonaje,
  SUGGEST_THRESHOLD,
} from './lost-path-suggest'

const CATALOGO = [
  { slug: 'naruto-uzumaki', nombre: 'Naruto Uzumaki' },
  { slug: 'sasuke-uchiha', nombre: 'Sasuke Uchiha' },
  { slug: 'goku', nombre: 'Goku' },
]

describe('levenshtein', () => {
  it('0 para cadenas idénticas; longitud para vacías', () => {
    expect(levenshtein('goku', 'goku')).toBe(0)
    expect(levenshtein('', 'goku')).toBe(4)
    expect(levenshtein('goku', '')).toBe(4)
  })

  it('cuenta inserciones/sustituciones', () => {
    expect(levenshtein('goku', 'gokuu')).toBe(1) // inserción
    expect(levenshtein('goku', 'goki')).toBe(1) // sustitución
    expect(levenshtein('naruto', 'narduto')).toBe(1)
  })
})

describe('extractPersonajeSlug', () => {
  it('extrae el slug de /personajes/<slug> (con o sin barra final)', () => {
    expect(extractPersonajeSlug('/personajes/goku')).toBe('goku')
    expect(extractPersonajeSlug('/personajes/Goku/')).toBe('goku')
    expect(extractPersonajeSlug('/personajes/goku?ref=x')).toBe('goku')
  })

  it('devuelve null fuera del patrón de personaje', () => {
    expect(extractPersonajeSlug('/personajes')).toBeNull()
    expect(extractPersonajeSlug('/personajes/goku/extra')).toBeNull()
    expect(extractPersonajeSlug('/ranking')).toBeNull()
    expect(extractPersonajeSlug('')).toBeNull()
    // @ts-expect-error robustez ante no-string
    expect(extractPersonajeSlug(null)).toBeNull()
  })
})

describe('suggestPersonaje', () => {
  it('sugiere el match más cercano ante un typo de alta confianza', () => {
    const s = suggestPersonaje('/personajes/naruto-uzamaki', CATALOGO)
    expect(s?.slug).toBe('naruto-uzumaki')
  })

  it('no sugiere nada cuando la similitud es baja (basura)', () => {
    expect(suggestPersonaje('/personajes/zzzzzzzzzz', CATALOGO)).toBeNull()
  })

  it('no sugiere si el slug existe EXACTO (no es un typo)', () => {
    expect(suggestPersonaje('/personajes/goku', CATALOGO)).toBeNull()
  })

  it('no sugiere fuera de /personajes ni con catálogo vacío', () => {
    expect(suggestPersonaje('/ranking', CATALOGO)).toBeNull()
    expect(suggestPersonaje('/personajes/goku-x', [])).toBeNull()
  })

  it('el umbral documentado es exigente (>= 0.72)', () => {
    expect(SUGGEST_THRESHOLD).toBeGreaterThanOrEqual(0.72)
  })
})
