import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { catalogo } from '../../lib/catalog.js'
import {
  EN_LA_SERIE,
  PUNTOS_ACIERTO,
  RONDAS,
  SEGUNDOS,
  esAcierto,
  familiaDe,
  nuevaPartida,
  nuevaRonda,
  puntosDeRonda,
  rangoDe,
  resumenDe,
  seriesBase,
} from './reglas.js'

describe('familiaDe', () => {
  it('agrupa las series hermanas por su primera palabra', () => {
    expect(familiaDe({ titulo: 'Fate/Zero' })).toBe('fate')
    expect(familiaDe({ titulo: 'Fate/stay night' })).toBe('fate')
    expect(familiaDe({ titulo: 'Dragon Ball Z' })).toBe(familiaDe({ titulo: 'Dragon Ball' }))
    expect(familiaDe({ titulo: 'Naruto' })).not.toBe(familiaDe({ titulo: 'Bleach' }))
    expect(familiaDe(undefined)).toBe('')
  })
})

describe('seriesBase', () => {
  it('solo propone series con personajes de sobra para cuatro', () => {
    const series = seriesBase()
    expect(series.length).toBeGreaterThan(0)
    for (const s of series) expect(s.count).toBeGreaterThanOrEqual(EN_LA_SERIE)
  })
})

describe('nuevaRonda', () => {
  it('da cinco cartas: cuatro de la serie base y un intruso de otra familia', () => {
    const ronda = nuevaRonda(crearAzar(7))
    expect(ronda.cartas).toHaveLength(EN_LA_SERIE + 1)
    expect(ronda.cartas).toContain(ronda.impostor)
    const propios = ronda.cartas.filter((c) => c.id !== ronda.impostor.id)
    expect(propios).toHaveLength(EN_LA_SERIE)
    for (const c of propios) expect(c.animeId).toBe(ronda.serie.id)
    expect(ronda.impostor.animeId).not.toBe(ronda.serie.id)
    expect(familiaDe(catalogo.anime(ronda.impostor.animeId))).not.toBe(familiaDe(ronda.serie))
    expect(new Set(ronda.cartas.map((c) => c.id)).size).toBe(5)
  })

  it('es determinista con semilla y cambia con otra', () => {
    const a = nuevaRonda(crearAzar(42))
    const b = nuevaRonda(crearAzar(42))
    expect(a.cartas.map((c) => c.id)).toEqual(b.cartas.map((c) => c.id))
    const ids = new Set()
    for (let s = 0; s < 20; s++) ids.add(nuevaRonda(crearAzar(s)).impostor.id)
    expect(ids.size).toBeGreaterThan(1)
  })

  it('respeta las series excluidas', () => {
    const primera = nuevaRonda(crearAzar(3))
    for (let s = 0; s < 30; s++) {
      const r = nuevaRonda(crearAzar(s), { excluirSeries: new Set([primera.serie.id]) })
      expect(r.serie.id).not.toBe(primera.serie.id)
    }
  })

  it('nunca sitúa al intruso siempre en la misma posición', () => {
    const posiciones = new Set()
    for (let s = 0; s < 40; s++) {
      const r = nuevaRonda(crearAzar(s))
      posiciones.add(r.cartas.findIndex((c) => c.id === r.impostor.id))
    }
    expect(posiciones.size).toBeGreaterThan(2)
  })
})

describe('nuevaPartida', () => {
  it('da tres rondas con series base distintas', () => {
    const rondas = nuevaPartida(crearAzar(11))
    expect(rondas).toHaveLength(RONDAS)
    expect(new Set(rondas.map((r) => r.serie.id)).size).toBe(RONDAS)
  })
})

describe('esAcierto', () => {
  const ronda = nuevaRonda(crearAzar(5))
  it('acierta solo con el id del intruso', () => {
    expect(esAcierto(ronda, ronda.impostor.id)).toBe(true)
    const otra = ronda.cartas.find((c) => c.id !== ronda.impostor.id)
    expect(esAcierto(ronda, otra.id)).toBe(false)
  })
  it('sin elección (tiempo agotado) es fallo', () => {
    expect(esAcierto(ronda, null)).toBe(false)
    expect(esAcierto(ronda, undefined)).toBe(false)
  })
})

describe('puntosDeRonda', () => {
  it('suma la base y los segundos sobrantes, acotados', () => {
    expect(puntosDeRonda(false, 14)).toBe(0)
    expect(puntosDeRonda(true, 0)).toBe(PUNTOS_ACIERTO)
    expect(puntosDeRonda(true, 7.9)).toBe(PUNTOS_ACIERTO + 7)
    expect(puntosDeRonda(true, 99)).toBe(PUNTOS_ACIERTO + SEGUNDOS)
    expect(puntosDeRonda(true, -3)).toBe(PUNTOS_ACIERTO)
  })
})

describe('resumenDe y rangoDe', () => {
  it('solo gana con los tres aciertos', () => {
    const tres = resumenDe([
      { acierto: true, puntos: 12 },
      { acierto: true, puntos: 15 },
      { acierto: true, puntos: 10 },
    ])
    expect(tres).toEqual({ aciertos: 3, puntos: 37, ganada: true, rango: 'Detective infalible' })
    const dos = resumenDe([
      { acierto: true, puntos: 12 },
      { acierto: false, puntos: 0 },
      { acierto: true, puntos: 10 },
    ])
    expect(dos.ganada).toBe(false)
    expect(dos.aciertos).toBe(2)
    expect(dos.rango).toBe('Buen ojo')
  })
  it('nombra cada rango', () => {
    expect(rangoDe(1)).toBe('Ronda salvada')
    expect(rangoDe(0)).toBe('Engaño total')
  })
})
