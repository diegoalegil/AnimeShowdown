import { describe, expect, it } from 'vitest'
import {
  GUION,
  MAX_LANTERNS,
  anioKanji,
  ballotPool,
  iniciales,
  nfEs,
  podio,
  visibleRooms,
} from './sanctuary-core'

describe('sanctuary-core · formateadores', () => {
  it('nfEs formatea al locale es-ES y trata null/undefined como 0', () => {
    // El separador de miles del ICU es robusto: normalizamos a dígitos.
    expect(nfEs(1234).replace(/[\s., ]/g, '')).toBe('1234')
    expect(nfEs(null)).toBe('0')
    expect(nfEs(undefined)).toBe('0')
  })

  it('anioKanji acuña el año en dígitos kanji decorativos', () => {
    expect(anioKanji(2026)).toBe('二零二六')
    expect(anioKanji('2026')).toBe('二零二六')
    expect(anioKanji(null)).toBe('')
  })

  it('iniciales saca hasta dos iniciales en mayúsculas', () => {
    expect(iniciales('Gojo Satoru')).toBe('GS')
    expect(iniciales('Goku')).toBe('G')
    expect(iniciales('')).toBe('')
  })
})

describe('sanctuary-core · derivación del guion de salas', () => {
  const base = {
    username: 'goku',
    votosTotales: 100,
    mejorRacha: 5,
    top3: [{ slug: 'a', nombre: 'A', anime: 'X', votos: 9 }],
    universoTop: { anime: 'X', slug: 'a', pct: 70 },
  }

  it('monta todas las salas cuando hay datos (entrada..emaki)', () => {
    const ids = visibleRooms(base).map((r) => r.id)
    expect(ids).toEqual(['entrada', 'votos', 'altar', 'racha', 'espejo', 'emaki'])
  })

  it('entrada y emaki existen SIEMPRE, aun sin datos', () => {
    const ids = visibleRooms({ username: 'x' }).map((r) => r.id)
    expect(ids).toEqual(['entrada', 'emaki'])
  })

  it('omite cada sala sin su dato (votos 0, top3 vacío, racha <1, universoTop sin anime)', () => {
    const ids = visibleRooms({
      username: 'x',
      votosTotales: 0,
      top3: [],
      mejorRacha: 0,
      universoTop: null,
    }).map((r) => r.id)
    expect(ids).toEqual(['entrada', 'emaki'])
  })

  it('racha === 1 SÍ monta la senda (copy con cariño lo decide el componente)', () => {
    const ids = visibleRooms({ ...base, votosTotales: 0, top3: [], universoTop: null, mejorRacha: 1 }).map(
      (r) => r.id,
    )
    expect(ids).toEqual(['entrada', 'racha', 'emaki'])
  })

  it('cada sala trae su kanji del guion', () => {
    for (const room of visibleRooms(base)) {
      expect(room.kanji).toBe(GUION[room.id as keyof typeof GUION].kanji)
    }
  })
})

describe('sanctuary-core · pool de papeletas determinista', () => {
  it('siempre produce MAX_LANTERNS nodos idénticos entre llamadas (cero Math.random)', () => {
    const a = ballotPool()
    const b = ballotPool()
    expect(a).toHaveLength(MAX_LANTERNS)
    expect(a).toEqual(b)
  })

  it('cada papeleta tiene posición/retardo/duración/rotación dentro de rango', () => {
    for (const p of ballotPool()) {
      expect(p.left).toMatch(/%$/)
      expect(p.delay).toMatch(/s$/)
      expect(p.dur).toMatch(/s$/)
      expect(p.rot).toMatch(/deg$/)
    }
  })
})

describe('sanctuary-core · podio', () => {
  it('coloca el nº1 en el centro cuando hay 3 (orden visual [II, I, III])', () => {
    const top3 = [
      { slug: 'a', nombre: 'A', votos: 9 },
      { slug: 'b', nombre: 'B', votos: 6 },
      { slug: 'c', nombre: 'C', votos: 3 },
    ]
    const p = podio(top3)
    expect(p.map((x) => x.nombre)).toEqual(['B', 'A', 'C'])
    expect(p.map((x) => x.rank)).toEqual([1, 0, 2])
  })

  it('respeta el orden cuando hay menos de 3', () => {
    const p = podio([{ slug: 'a', nombre: 'A', votos: 9 }])
    expect(p.map((x) => x.nombre)).toEqual(['A'])
    expect(p[0].rank).toBe(0)
  })
})
