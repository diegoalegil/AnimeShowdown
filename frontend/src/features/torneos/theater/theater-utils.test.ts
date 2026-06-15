import { describe, expect, it } from 'vitest'
// @ts-expect-error — módulo JS hermano sin tipos (funciones puras del teatro).
import { compileScript, deriveBracketState, normalizeRounds } from './theater-utils'

// ── theater-utils: funciones PURAS del Teatro del Torneo ─────────────────────
// Cubren los dos fallos reales que cazó la revisión adversarial de la pieza 116:
//  (1) votos cruzados con el personaje en rondas > 0 (slot re-derivado por
//      feeders pero voto emitido por posición), y
//  (2) crash por .slug de un personaje null cuando `ganador` es truthy (bye).

const A = { id: 1, slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball' }
const B = { id: 2, slug: 'vegeta', nombre: 'Vegeta', anime: 'Dragon Ball' }
const C = { id: 3, slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' }
const D = { id: 4, slug: 'zoro', nombre: 'Zoro', anime: 'One Piece' }

describe('normalizeRounds (array plano del backend → Match[][])', () => {
  it('agrupa por ronda asc, ordena por id asc y mapea votos/estado/ganadorSlug', () => {
    const rounds = normalizeRounds([
      { id: 2, ronda: 1, personaje1: C, personaje2: D, ganador: D, personaje1Votos: 30, personaje2Votos: 70 },
      { id: 1, ronda: 1, personaje1: A, personaje2: B, ganador: A, personaje1Votos: 60, personaje2Votos: 40 },
      { id: 3, ronda: 2, personaje1: D, personaje2: A, ganador: null, personaje1Votos: 0, personaje2Votos: 0 },
    ])
    expect(rounds).toHaveLength(2)
    expect(rounds[0].map((m: { id: number }) => m.id)).toEqual([1, 2]) // ordenados por id
    expect(rounds[0][0]).toMatchObject({ votos1: 60, votos2: 40, estado: 'RESOLVED', ganadorSlug: 'goku' })
    expect(rounds[1][0]).toMatchObject({ estado: 'OPEN', ganadorSlug: null }) // sin ganador
  })
})

describe('deriveBracketState — votos siguen al personaje del slot (no a la posición)', () => {
  it('en una final con personaje1/2 INVERTIDOS respecto a los feeders, el voto va con el nombre', () => {
    // Final almacenada como personaje1=Zoro(45) / personaje2=Goku(80), pero los
    // feeders sientan slot1=Goku (gana m1) y slot2=Zoro (gana m2). El número
    // debe seguir al personaje: Goku→80, Zoro→45 (no 45/80 por posición).
    const rounds = normalizeRounds([
      { id: 1, ronda: 1, personaje1: A, personaje2: B, ganador: A, personaje1Votos: 60, personaje2Votos: 40 },
      { id: 2, ronda: 1, personaje1: C, personaje2: D, ganador: D, personaje1Votos: 30, personaje2Votos: 70 },
      { id: 3, ronda: 2, personaje1: D, personaje2: A, ganador: A, personaje1Votos: 45, personaje2Votos: 80 },
    ])
    const { rondas, campeon } = deriveBracketState({}, rounds, 3) // 3 pasos = todo resuelto
    const final = rondas[1][0]
    // votos1↔slot1, votos2↔slot2 (así los consume MatchScroll). Con la final
    // invertida, votos1 debe ser el de Goku (80), no el votos1 posicional (45).
    expect(final.slot1.persona.slug).toBe('goku')
    expect(final.votos1).toBe(80)
    expect(final.slot2.persona.slug).toBe('zoro')
    expect(final.votos2).toBe(45)
    expect(final.slot1.isWinner).toBe(true)
    expect(campeon.slug).toBe('goku')
  })
})

describe('theater-utils — robustez ante bye/walkover (personaje null con ganador)', () => {
  it('no revienta al compilar/derivar un match RESUELTO con un slot sin persona', () => {
    const rounds = normalizeRounds([
      // bye: personaje1 ausente, gana personaje2; antes esto petaba en .slug.
      { id: 1, ronda: 1, personaje1: null, personaje2: A, ganador: A, personaje1Votos: 0, personaje2Votos: 50 },
      { id: 2, ronda: 1, personaje1: B, personaje2: C, ganador: B, personaje1Votos: 20, personaje2Votos: 10 },
    ])
    expect(() => compileScript(rounds)).not.toThrow()
    expect(() => deriveBracketState({}, rounds, 2)).not.toThrow()
    // El bye no genera paso de "X elimina a Y" (no hubo duelo real).
    const { steps } = compileScript(rounds)
    expect(steps.some((s: { matchId: number }) => s.matchId === 1)).toBe(false)
    expect(steps.some((s: { matchId: number }) => s.matchId === 2)).toBe(true)
  })
})
