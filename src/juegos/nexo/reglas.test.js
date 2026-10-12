import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import {
  MAX_ERRORES,
  PAREJAS,
  destapar,
  estadoDelNaipe,
  estadoInicial,
  formatoTiempo,
  hayFallo,
  iniciales,
  nuevoTablero,
  puntuacion,
  taparFallo,
} from './reglas.js'

/** Índices de los dos naipes de la serie `animeId`. */
const pareja = (tablero, animeId) => tablero.naipes.filter((n) => n.animeId === animeId).map((n) => n.indice)

/** Dos naipes de series distintas. */
const dispareja = (tablero) => {
  const [a] = tablero.naipes
  const b = tablero.naipes.find((n) => n.animeId !== a.animeId)
  return [a.indice, b.indice]
}

describe('nuevoTablero', () => {
  it('da ocho naipes de cuatro series distintas, dos por serie, con índices 0–7', () => {
    const tablero = nuevoTablero(crearAzar(3))
    expect(tablero.parejas).toHaveLength(PAREJAS)
    expect(tablero.naipes).toHaveLength(8)
    const porSerie = new Map()
    for (const n of tablero.naipes) porSerie.set(n.animeId, (porSerie.get(n.animeId) ?? 0) + 1)
    expect(porSerie.size).toBe(4)
    expect([...porSerie.values()]).toEqual([2, 2, 2, 2])
    expect(tablero.naipes.map((n) => n.indice)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(new Set(tablero.naipes.map((n) => n.carta.id)).size).toBe(8)
  })

  it('cada naipe pertenece a la serie de su carta', () => {
    const tablero = nuevoTablero(crearAzar(11))
    for (const n of tablero.naipes) expect(n.carta.animeId).toBe(n.animeId)
  })

  it('es determinista con semilla y cambia con otra', () => {
    const ids = (t) => t.naipes.map((n) => n.carta.id)
    expect(ids(nuevoTablero(crearAzar(42)))).toEqual(ids(nuevoTablero(crearAzar(42))))
    expect(ids(nuevoTablero(crearAzar(42)))).not.toEqual(ids(nuevoTablero(crearAzar(43))))
  })
})

describe('destapar', () => {
  const tablero = nuevoTablero(crearAzar(5))

  it('la primera carta solo queda destapada', () => {
    const estado = destapar(tablero, estadoInicial(), 0)
    expect(estado.destapadas).toEqual([0])
    expect(estado.intentos).toBe(0)
  })

  it('ignora la misma carta dos veces y los índices fuera del tablero', () => {
    const uno = destapar(tablero, estadoInicial(), 0)
    expect(destapar(tablero, uno, 0)).toBe(uno)
    expect(destapar(tablero, uno, 8)).toBe(uno)
    expect(destapar(tablero, uno, -1)).toBe(uno)
  })

  it('une una pareja de la misma serie y cuenta el intento sin error', () => {
    const [a, b] = pareja(tablero, tablero.naipes[0].animeId)
    const estado = destapar(tablero, destapar(tablero, estadoInicial(), a), b)
    expect(estado.unidas).toEqual([tablero.naipes[0].animeId])
    expect(estado.destapadas).toEqual([])
    expect(estado.intentos).toBe(1)
    expect(estado.errores).toBe(0)
    expect(estado.fin).toBeNull()
  })

  it('dos de series distintas son un fallo que espera a taparse', () => {
    const [a, b] = dispareja(tablero)
    const estado = destapar(tablero, destapar(tablero, estadoInicial(), a), b)
    expect(hayFallo(estado)).toBe(true)
    expect(estado.destapadas).toEqual([a, b])
    expect(estado.errores).toBe(1)
    expect(estado.intentos).toBe(1)
    expect(estadoDelNaipe(tablero, estado, a)).toBe('fallo')
    expect(taparFallo(estado).destapadas).toEqual([])
  })

  it('destapar una tercera con un fallo pendiente tapa las otras dos primero', () => {
    const [a, b] = dispareja(tablero)
    const otra = tablero.naipes.find((n) => n.indice !== a && n.indice !== b).indice
    const estado = destapar(tablero, destapar(tablero, destapar(tablero, estadoInicial(), a), b), otra)
    expect(estado.destapadas).toEqual([otra])
    expect(estado.errores).toBe(1)
  })

  it('no deja volver a destapar una carta ya unida', () => {
    const [a, b] = pareja(tablero, tablero.naipes[0].animeId)
    const unida = destapar(tablero, destapar(tablero, estadoInicial(), a), b)
    expect(destapar(tablero, unida, a)).toBe(unida)
  })

  it('la victoria llega al unir las cuatro parejas', () => {
    let estado = estadoInicial()
    for (const { serie } of tablero.parejas) {
      const [a, b] = pareja(tablero, serie.id)
      estado = destapar(tablero, destapar(tablero, estado, a), b)
    }
    expect(estado.fin).toBe('victoria')
    expect(estado.intentos).toBe(4)
    expect(estado.errores).toBe(0)
    expect(destapar(tablero, estado, 0)).toBe(estado)
  })

  it('se puede ganar con exactamente MAX_ERRORES errores', () => {
    let estado = estadoInicial()
    const [a, b] = dispareja(tablero)
    for (let i = 0; i < MAX_ERRORES; i++) estado = destapar(tablero, destapar(tablero, estado, a), b)
    expect(estado.errores).toBe(MAX_ERRORES)
    expect(estado.fin).toBeNull()
    for (const { serie } of tablero.parejas) {
      const [x, y] = pareja(tablero, serie.id)
      estado = destapar(tablero, destapar(tablero, estado, x), y)
    }
    expect(estado.fin).toBe('victoria')
  })

  it('el error número MAX_ERRORES + 1 es derrota y destapa el tablero', () => {
    let estado = estadoInicial()
    const [a, b] = dispareja(tablero)
    for (let i = 0; i <= MAX_ERRORES; i++) estado = destapar(tablero, destapar(tablero, estado, a), b)
    expect(estado.fin).toBe('derrota')
    expect(estado.errores).toBe(MAX_ERRORES + 1)
    expect(hayFallo(estado)).toBe(false)
    expect(estadoDelNaipe(tablero, estado, 0)).toBe('destapada')
    expect(destapar(tablero, estado, 3)).toBe(estado)
  })
})

describe('puntuacion', () => {
  it('premia la victoria limpia y rápida, resta por errores y segundos, y no baja de 10', () => {
    const victoria = (errores) => ({ fin: 'victoria', errores })
    expect(puntuacion(victoria(0), 0)).toBe(100)
    expect(puntuacion(victoria(1), 10)).toBe(75)
    expect(puntuacion(victoria(3), 600)).toBe(10)
    expect(puntuacion(victoria(0), -5)).toBe(100)
  })

  it('una derrota o una partida a medias no puntúan', () => {
    expect(puntuacion({ fin: 'derrota', errores: 4 }, 3)).toBe(0)
    expect(puntuacion({ fin: null, errores: 0 }, 3)).toBe(0)
  })
})

describe('iniciales y tiempo', () => {
  it('saca dos letras del nombre', () => {
    expect(iniciales('Monkey D. Luffy')).toBe('MD')
    expect(iniciales('Saitama')).toBe('SA')
    expect(iniciales('  L ')).toBe('L')
    expect(iniciales('')).toBe('')
  })

  it('formatea m:ss', () => {
    expect(formatoTiempo(0)).toBe('0:00')
    expect(formatoTiempo(65.9)).toBe('1:05')
    expect(formatoTiempo(-3)).toBe('0:00')
  })
})
