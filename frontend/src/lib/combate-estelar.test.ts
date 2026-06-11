import { describe, expect, it } from 'vitest'
import { getCombateEstelarDelDia } from './combate-estelar'
import { CATALOGO, personaje } from './combate-estelar.fixtures'

describe('getCombateEstelarDelDia', () => {
  it('devuelve el mismo duelo para la misma fecha (determinista)', () => {
    const fecha = new Date(2026, 5, 11, 9, 30)
    const primero = getCombateEstelarDelDia(CATALOGO, fecha)
    const segundo = getCombateEstelarDelDia(CATALOGO, new Date(2026, 5, 11, 23, 59))

    expect(primero).not.toBeNull()
    expect(segundo?.retador.slug).toBe(primero?.retador.slug)
    expect(segundo?.rival.slug).toBe(primero?.rival.slug)
  })

  it('cruza universos: nunca empareja dos personajes del mismo anime', () => {
    for (let dia = 0; dia < 40; dia += 1) {
      const fecha = new Date(2026, 0, 1 + dia)
      const combate = getCombateEstelarDelDia(CATALOGO, fecha)
      expect(combate).not.toBeNull()
      expect(combate?.retador.slug).not.toBe(combate?.rival.slug)
      expect(combate?.retador.anime).not.toBe(combate?.rival.anime)
    }
  })

  it('rota el cartel entre días consecutivos', () => {
    const hoy = getCombateEstelarDelDia(CATALOGO, new Date(2026, 5, 11))
    const manana = getCombateEstelarDelDia(CATALOGO, new Date(2026, 5, 12))

    expect(`${hoy?.retador.slug}-${hoy?.rival.slug}`).not.toBe(
      `${manana?.retador.slug}-${manana?.rival.slug}`,
    )
  })

  it('expone las stats estimadas que pinta el tale of the tape', () => {
    const combate = getCombateEstelarDelDia(CATALOGO, new Date(2026, 5, 11))
    expect(combate?.retador.elo).toBeGreaterThan(0)
    expect(combate?.retador.wins).toBeGreaterThan(0)
    expect(combate?.rival.losses).toBeGreaterThan(0)
  })

  it('excluye personajes sin arte promocionable', () => {
    const conSentinel = [
      ...CATALOGO.slice(0, 2),
      { ...personaje('x', 'X', 'Otro', '#111111'), imagenUrl: '/img/_missing/x.webp' },
    ]
    for (let dia = 0; dia < 10; dia += 1) {
      const combate = getCombateEstelarDelDia(conSentinel, new Date(2026, 0, 1 + dia))
      expect(combate?.retador.slug).not.toBe('x')
      expect(combate?.rival.slug).not.toBe('x')
    }
  })

  it('devuelve null si el pool no da para un duelo', () => {
    expect(getCombateEstelarDelDia([], new Date(2026, 5, 11))).toBeNull()
    expect(getCombateEstelarDelDia([CATALOGO[0]], new Date(2026, 5, 11))).toBeNull()
  })
})
