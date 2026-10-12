import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { PERSONAJES } from '../comun/cartas.js'
import {
  ALTO_CELDA,
  DURACION_GIRO,
  GIROS_POR_ROSTER,
  ROSTER_MAX,
  VUELTAS_MIN,
  anuncioDe,
  nuevoRoster,
  planificarGiro,
  posicionCarrete,
  sortear,
  tocaRenovar,
} from './reglas.js'

describe('nuevoRoster', () => {
  it('da hasta ROSTER_MAX personajes distintos del catálogo', () => {
    const roster = nuevoRoster(crearAzar(1))
    expect(roster).toHaveLength(Math.min(ROSTER_MAX, PERSONAJES.length))
    expect(new Set(roster.map((c) => c.id)).size).toBe(roster.length)
    for (const carta of roster) expect(PERSONAJES).toContain(carta)
  })

  it('es determinista con semilla y cambia con otra', () => {
    const a = nuevoRoster(crearAzar(5)).map((c) => c.id)
    expect(nuevoRoster(crearAzar(5)).map((c) => c.id)).toEqual(a)
    expect(nuevoRoster(crearAzar(6)).map((c) => c.id)).not.toEqual(a)
  })

  it('con una lista corta la devuelve entera barajada', () => {
    const lista = PERSONAJES.slice(0, 3)
    const roster = nuevoRoster(crearAzar(2), lista)
    expect(roster).toHaveLength(3)
    expect(new Set(roster)).toEqual(new Set(lista))
  })
})

describe('sortear', () => {
  it('devuelve un índice dentro del roster, aunque el generador dé 1', () => {
    const roster = nuevoRoster(crearAzar(3))
    expect(sortear(roster, () => 0.999999)).toBe(roster.length - 1)
    expect(sortear(roster, () => 0)).toBe(0)
    const rng = crearAzar(9)
    for (let i = 0; i < 200; i++) {
      const indice = sortear(roster, rng)
      expect(indice).toBeGreaterThanOrEqual(0)
      expect(indice).toBeLessThan(roster.length)
    }
  })

  it('con el tiempo salen personajes distintos', () => {
    const roster = nuevoRoster(crearAzar(4))
    const rng = crearAzar(11)
    const vistos = new Set()
    for (let i = 0; i < 300; i++) vistos.add(sortear(roster, rng))
    expect(vistos.size).toBeGreaterThan(roster.length / 2)
  })
})

describe('tocaRenovar', () => {
  it('renueva cada GIROS_POR_ROSTER giros, nunca antes del primero', () => {
    expect(tocaRenovar(0)).toBe(false)
    expect(tocaRenovar(1)).toBe(false)
    expect(tocaRenovar(GIROS_POR_ROSTER - 1)).toBe(false)
    expect(tocaRenovar(GIROS_POR_ROSTER)).toBe(true)
    expect(tocaRenovar(GIROS_POR_ROSTER * 3)).toBe(true)
  })
})

describe('posicionCarrete', () => {
  const n = 10
  const vuelta = n * ALTO_CELDA

  it('con y = i·alto deja la celda i de la copia central en la celda del medio', () => {
    for (let i = 0; i < n; i++) {
      const translate = posicionCarrete(i * ALTO_CELDA, n)
      // La celda i de la copia central empieza en vuelta + i·alto dentro del carrete.
      expect(translate + vuelta + i * ALTO_CELDA).toBe(ALTO_CELDA)
    }
  })

  it('es periódica y tolera posiciones negativas', () => {
    expect(posicionCarrete(3 * ALTO_CELDA + vuelta * 7, n)).toBe(posicionCarrete(3 * ALTO_CELDA, n))
    expect(posicionCarrete(-ALTO_CELDA, n)).toBe(posicionCarrete((n - 1) * ALTO_CELDA, n))
  })
})

describe('planificarGiro', () => {
  const n = 60
  const vuelta = n * ALTO_CELDA
  const casos = [
    [0, 0],
    [0, 59],
    [0, 1],
    [5 * ALTO_CELDA, 5],
    [5 * ALTO_CELDA, 4],
    [vuelta * 3 + 17 * ALTO_CELDA, 42],
    [-ALTO_CELDA * 2, 7],
  ]

  it.each(casos)('desde %i hasta la celda %i aterriza exacto', (desde, indice) => {
    const plan = planificarGiro(desde, indice, n)
    const resto = ((plan.destino % vuelta) + vuelta) % vuelta
    expect(resto).toBeCloseTo(indice * ALTO_CELDA, 6)
    expect(plan.en(plan.duracion).y).toBeCloseTo(plan.destino, 6)
    expect(plan.en(plan.duracion + 1000).y).toBeCloseTo(plan.destino, 6)
  })

  it.each(casos)('desde %i hasta %i da al menos las vueltas mínimas y recorre bastante', (desde, indice) => {
    const plan = planificarGiro(desde, indice, n)
    expect(plan.vueltas).toBeGreaterThanOrEqual(VUELTAS_MIN)
    expect(plan.distancia).toBeGreaterThan(VUELTAS_MIN * vuelta)
    expect(plan.distancia).toBeLessThanOrEqual((VUELTAS_MIN + 1) * vuelta)
  })

  it('siempre avanza hacia abajo y sin saltos entre fases', () => {
    const plan = planificarGiro(123, 31, n)
    let anterior = plan.en(0)
    expect(anterior.y).toBe(123)
    expect(anterior.escala).toBe(1)
    for (let t = 1; t <= plan.duracion; t += 1) {
      const actual = plan.en(t)
      expect(actual.y).toBeGreaterThanOrEqual(anterior.y)
      // Un milisegundo nunca mueve más de unos píxeles: no hay saltos.
      expect(actual.y - anterior.y).toBeLessThan(12)
      expect(actual.escala).toBeGreaterThanOrEqual(1)
      expect(actual.escala).toBeLessThanOrEqual(1.02)
      anterior = actual
    }
    expect(anterior.escala).toBe(1)
  })

  it('frena de verdad: el último tramo avanza mucho menos que el crucero', () => {
    const plan = planificarGiro(0, 20, n)
    const crucero = plan.en(1000).y - plan.en(900).y
    const final = plan.en(DURACION_GIRO).y - plan.en(DURACION_GIRO - 100).y
    expect(final).toBeLessThan(crucero / 20)
  })

  it('con un roster pequeño sigue dando vueltas enteras y cae en su sitio', () => {
    const plan = planificarGiro(0, 2, 3)
    const chica = 3 * ALTO_CELDA
    expect(((plan.destino % chica) + chica) % chica).toBeCloseTo(2 * ALTO_CELDA, 6)
    expect(plan.vueltas).toBeGreaterThanOrEqual(VUELTAS_MIN)
  })
})

describe('anuncioDe', () => {
  it('nombra al personaje y su serie', () => {
    expect(anuncioDe({ nombre: 'Rem', anime: 'Re:Zero' })).toBe('El destino eligió a Rem, de Re:Zero.')
  })
})
