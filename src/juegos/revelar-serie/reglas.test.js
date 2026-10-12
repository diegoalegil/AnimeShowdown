import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { PERSONAJES, SERIES } from '../comun/cartas.js'
import {
  DESENFOQUE,
  MAX_INTENTOS,
  PUNTOS,
  anotarJugado,
  desenfoque,
  generoEnEspanol,
  intentar,
  intentosRestantes,
  intentosUsados,
  nivel,
  nuevaPartida,
  pedirPista,
  puedePedirPista,
  puntos,
  textoFicha,
  tieneFicha,
  yaProbada,
} from './reglas.js'

/** Una serie que no es la del objetivo. */
const otraSerie = (partida, saltar = 0) => SERIES.filter((s) => s.id !== partida.objetivo.animeId)[saltar]

/** Falla `n` veces seguidas, con series distintas. */
function fallar(partida, n) {
  let p = partida
  for (let i = 0; i < n; i++) p = intentar(p, otraSerie(p, p.intentos.length))
  return p
}

describe('nuevaPartida', () => {
  it('elige un personaje del catálogo y su serie', () => {
    const partida = nuevaPartida(crearAzar(3))
    expect(PERSONAJES).toContain(partida.objetivo)
    expect(partida.serie.id).toBe(partida.objetivo.animeId)
    expect(partida.intentos).toEqual([])
    expect(partida.pistas).toEqual([])
    expect(partida.fin).toBeNull()
  })

  it('es determinista con semilla', () => {
    expect(nuevaPartida(crearAzar(11)).objetivo).toBe(nuevaPartida(crearAzar(11)).objetivo)
    expect(nuevaPartida(crearAzar(11)).objetivo).not.toBe(nuevaPartida(crearAzar(12)).objetivo)
  })

  it('respeta los ids excluidos', () => {
    const rng = crearAzar(5)
    const primera = nuevaPartida(crearAzar(5))
    const excluir = new Set([primera.objetivo.id])
    for (let i = 0; i < 40; i++) expect(excluir.has(nuevaPartida(rng, { excluir }).objetivo.id)).toBe(false)
  })
})

describe('intentar', () => {
  it('gana al acertar la serie, comparando por id', () => {
    const partida = nuevaPartida(crearAzar(7))
    const fin = intentar(partida, { ...partida.serie })
    expect(fin.fin).toEqual({ ganada: true })
    expect(fin.intentos).toHaveLength(1)
    expect(fin.intentos[0].acierto).toBe(true)
  })

  it('un fallo gasta un intento y la partida sigue', () => {
    const partida = fallar(nuevaPartida(crearAzar(7)), 1)
    expect(partida.fin).toBeNull()
    expect(intentosUsados(partida)).toBe(1)
    expect(intentosRestantes(partida)).toBe(MAX_INTENTOS - 1)
    expect(partida.intentos[0].acierto).toBe(false)
  })

  it('pierde al agotar los cinco intentos', () => {
    const partida = fallar(nuevaPartida(crearAzar(7)), MAX_INTENTOS)
    expect(partida.fin).toEqual({ ganada: false })
    expect(intentosRestantes(partida)).toBe(0)
  })

  it('gana en el último intento', () => {
    const partida = fallar(nuevaPartida(crearAzar(7)), MAX_INTENTOS - 1)
    const fin = intentar(partida, partida.serie)
    expect(fin.fin).toEqual({ ganada: true })
    expect(intentosUsados(fin)).toBe(MAX_INTENTOS)
  })

  it('repetir una serie no gasta intento', () => {
    const partida = fallar(nuevaPartida(crearAzar(7)), 1)
    const repetida = intentar(partida, partida.intentos[0].serie)
    expect(repetida).toBe(partida)
    expect(yaProbada(partida, partida.intentos[0].serie)).toBe(true)
  })

  it('no cambia nada tras terminar', () => {
    const fin = intentar(nuevaPartida(crearAzar(7)), nuevaPartida(crearAzar(7)).serie)
    expect(intentar(fin, otraSerie(fin))).toBe(fin)
    expect(pedirPista(fin, 'nombre')).toBe(fin)
  })

  it('no toca la partida anterior', () => {
    const partida = nuevaPartida(crearAzar(7))
    fallar(partida, 2)
    expect(partida.intentos).toEqual([])
  })
})

describe('pistas', () => {
  it('cada pista cuesta un intento y se anota una sola vez', () => {
    const partida = nuevaPartida(crearAzar(9))
    const conNombre = pedirPista(partida, 'nombre')
    expect(conNombre.pistas).toEqual(['nombre'])
    expect(intentosUsados(conNombre)).toBe(1)
    expect(puedePedirPista(conNombre, 'nombre')).toBe(false)
    expect(pedirPista(conNombre, 'nombre')).toBe(conNombre)
  })

  it('las dos pistas y tres fallos agotan la partida', () => {
    let partida = pedirPista(pedirPista(nuevaPartida(crearAzar(9)), 'nombre'), 'ficha')
    expect(intentosUsados(partida)).toBe(2)
    partida = fallar(partida, 3)
    expect(partida.fin).toEqual({ ganada: false })
  })

  it('no se puede pedir pista con un solo intento restante', () => {
    const partida = fallar(nuevaPartida(crearAzar(9)), MAX_INTENTOS - 1)
    expect(intentosRestantes(partida)).toBe(1)
    expect(puedePedirPista(partida, 'nombre')).toBe(false)
    expect(puedePedirPista(partida, 'ficha')).toBe(false)
    expect(pedirPista(partida, 'nombre')).toBe(partida)
  })

  it('la ficha solo si la serie tiene año o géneros', () => {
    const base = nuevaPartida(crearAzar(9))
    const sinDatos = { ...base, serie: { ...base.serie, anio: undefined, generos: [] } }
    expect(tieneFicha(sinDatos.serie)).toBe(false)
    expect(puedePedirPista(sinDatos, 'ficha')).toBe(false)
    expect(puedePedirPista(sinDatos, 'nombre')).toBe(true)
    expect(puedePedirPista({ ...base, serie: { ...base.serie, anio: 2010, generos: undefined } }, 'ficha')).toBe(true)
  })

  it('una pista desconocida no existe', () => {
    expect(puedePedirPista(nuevaPartida(crearAzar(9)), 'elo')).toBe(false)
  })

  it('textoFicha junta año y géneros traducidos', () => {
    expect(textoFicha({ anio: 2021, generos: ['Action', 'Sci-Fi'] })).toBe('2021 · Acción, Ciencia ficción')
    expect(textoFicha({ generos: ['Drama'] })).toBe('Drama')
    expect(textoFicha({ anio: 1998 })).toBe('1998')
    expect(textoFicha({})).toBe('')
    expect(generoEnEspanol('Isekai')).toBe('Isekai')
  })
})

describe('desenfoque', () => {
  it('baja un paso fijo por intento gastado y nunca llega a 0 jugando', () => {
    expect(DESENFOQUE).toEqual([32, 24, 16, 10, 6])
    expect(DESENFOQUE).toHaveLength(MAX_INTENTOS)
    expect(Math.min(...DESENFOQUE)).toBeGreaterThan(0)
    let partida = nuevaPartida(crearAzar(4))
    expect(desenfoque(partida)).toBe(32)
    partida = pedirPista(partida, 'nombre')
    expect(desenfoque(partida)).toBe(24)
    partida = fallar(partida, 1)
    expect(desenfoque(partida)).toBe(16)
    partida = fallar(partida, 2)
    expect(desenfoque(partida)).toBe(6)
  })

  it('al terminar el arte queda nítido', () => {
    const partida = nuevaPartida(crearAzar(4))
    expect(desenfoque(intentar(partida, partida.serie))).toBe(0)
  })
})

describe('puntos y nivel', () => {
  it('puntúa según los intentos gastados', () => {
    expect(PUNTOS).toHaveLength(MAX_INTENTOS)
    const partida = nuevaPartida(crearAzar(2))
    expect(puntos(intentar(partida, partida.serie))).toBe(100)
    const tarde = fallar(partida, 4)
    expect(puntos(intentar(tarde, tarde.serie))).toBe(20)
    const conPista = pedirPista(partida, 'nombre')
    expect(puntos(intentar(conPista, conPista.serie))).toBe(80)
  })

  it('sin acierto, cero puntos y un título digno', () => {
    const partida = nuevaPartida(crearAzar(2))
    expect(puntos(partida)).toBe(0)
    const perdida = fallar(partida, MAX_INTENTOS)
    expect(puntos(perdida)).toBe(0)
    expect(nivel(perdida)).toBe('La serie guardó su secreto')
  })

  it('el nivel distingue cuánto costó acertar', () => {
    const partida = nuevaPartida(crearAzar(2))
    expect(nivel(intentar(partida, partida.serie))).toBe('Otaku certificado')
    expect(nivel(intentar(fallar(partida, 1), partida.serie))).toBe('Ojo entrenado')
    expect(nivel(intentar(fallar(partida, 2), partida.serie))).toBe('Bien visto')
    expect(nivel(intentar(fallar(partida, 3), partida.serie))).toBe('Por los pelos')
    expect(nivel(intentar(fallar(partida, 4), partida.serie))).toBe('Justo a tiempo')
  })
})

describe('anotarJugado', () => {
  it('acumula ids sin tocar el conjunto anterior', () => {
    const antes = new Set(['a'])
    const despues = anotarJugado(antes, 'b', 10)
    expect([...despues]).toEqual(['a', 'b'])
    expect(antes.size).toBe(1)
  })

  it('se vacía al agotar el catálogo', () => {
    expect(anotarJugado(new Set(['a', 'b']), 'c', 3).size).toBe(0)
  })
})
