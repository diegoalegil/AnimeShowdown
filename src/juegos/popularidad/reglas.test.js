import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { conPopularidad, popularidad } from '../comun/cartas.js'
import {
  CLAVE_RECORD,
  DUELOS_POR_RONDA,
  INCLINACION_MAX,
  INCLINACION_MIN,
  PROPORCION_MAX,
  PROPORCION_MIN,
  elegirRetadora,
  esRetadoraValida,
  formatearFavs,
  guardarMejorRacha,
  inclinacion,
  leerMejorRacha,
  nuevaRonda,
  pesasDeRacha,
  proporcion,
  resolver,
  respuestaCorrecta,
  siguienteDuelo,
  valorContador,
} from './reglas.js'

const carta = (id, favs, nombre = `Personaje ${id}`) => ({ id, nombre, anime: 'Serie', animeId: 'serie', favs })

// Una lista pequeña y controlada: la referencia (1000) con retadoras en banda y fuera de ella.
const LISTA = [
  carta('ref', 1000),
  carta('igual', 1000), // mismos favoritos: nunca
  carta('casi', 1050), // proporción 1,05: demasiado parecida
  carta('justo', 1080), // proporción 1,08: entra
  carta('doble', 2000), // 2,0: entra
  carta('mitad', 500), // 2,0: entra
  carta('tope', 2500), // 2,5: entra
  carta('lejos', 2600), // 2,6: fuera
  carta('homonimo', 1500, 'Personaje ref'), // mismo nombre, otra serie: nunca
  carta('sinfavs', 0),
]

describe('proporcion y esRetadoraValida', () => {
  it('la proporción es siempre la mayor entre la menor', () => {
    expect(proporcion(carta('a', 1000), carta('b', 2000))).toBe(2)
    expect(proporcion(carta('a', 2000), carta('b', 1000))).toBe(2)
    expect(proporcion(carta('a', 0), carta('b', 10))).toBe(Infinity)
  })

  it('acepta solo la banda [1,08; 2,5] con favoritos distintos, otra carta y otro nombre', () => {
    const ref = LISTA[0]
    const validas = LISTA.filter((c) => esRetadoraValida(ref, c)).map((c) => c.id)
    expect(validas).toEqual(['justo', 'doble', 'mitad', 'tope'])
  })
})

describe('elegirRetadora', () => {
  it('elige entre las válidas y respeta las excluidas', () => {
    const ref = LISTA[0]
    const rng = crearAzar(3)
    for (let i = 0; i < 40; i++) {
      const r = elegirRetadora(ref, LISTA, rng, { excluir: new Set(['doble']) })
      expect(['justo', 'mitad', 'tope']).toContain(r.id)
    }
  })

  it('sin ninguna en banda, cae a la más cercana con favoritos distintos (nunca un empate)', () => {
    const ref = carta('ref', 1000)
    const lista = [ref, carta('igual', 1000), carta('casi', 1050), carta('lejos', 4000)]
    expect(elegirRetadora(ref, lista, crearAzar(1)).id).toBe('casi')
    expect(elegirRetadora(ref, [ref, carta('igual', 1000)], crearAzar(1))).toBeUndefined()
  })

  it('es determinista con semilla', () => {
    const a = elegirRetadora(LISTA[0], LISTA, crearAzar(42))
    const b = elegirRetadora(LISTA[0], LISTA, crearAzar(42))
    expect(a.id).toBe(b.id)
  })
})

describe('nuevaRonda, resolver y siguienteDuelo', () => {
  it('arranca en el duelo 1 con una retadora válida y las dos cartas anotadas como vistas', () => {
    const ronda = nuevaRonda(crearAzar(7), LISTA)
    expect(ronda.duelo).toBe(1)
    expect(ronda.aciertos).toBe(0)
    expect(ronda.retadora.id).not.toBe(ronda.referencia.id)
    expect(popularidad(ronda.retadora)).not.toBe(popularidad(ronda.referencia))
    expect(ronda.vistos).toEqual(new Set([ronda.referencia.id, ronda.retadora.id]))
  })

  it('con el catálogo real, mil rondas con semilla salen siempre en banda y sin empates', () => {
    const rng = crearAzar('popularidad:test')
    const lista = conPopularidad()
    for (let i = 0; i < 1000; i++) {
      const r = nuevaRonda(rng, lista)
      const p = proporcion(r.referencia, r.retadora)
      expect(p).toBeGreaterThanOrEqual(PROPORCION_MIN)
      expect(p).toBeLessThanOrEqual(PROPORCION_MAX)
      expect(r.retadora.nombre).not.toBe(r.referencia.nombre)
    }
  })

  it('la respuesta correcta mira los favoritos de la retadora frente a la referencia', () => {
    expect(respuestaCorrecta({ referencia: carta('a', 100), retadora: carta('b', 150) })).toBe('mas')
    expect(respuestaCorrecta({ referencia: carta('a', 150), retadora: carta('b', 100) })).toBe('menos')
  })

  it('un fallo termina la ronda sin ganarla; un acierto intermedio la continúa', () => {
    const ronda = { referencia: carta('a', 100), retadora: carta('b', 150), duelo: 1, aciertos: 0, vistos: new Set(['a', 'b']) }
    expect(resolver(ronda, 'menos')).toEqual({ acierto: false, correcta: 'mas', ganada: false, terminada: true })
    expect(resolver(ronda, 'mas')).toEqual({ acierto: true, correcta: 'mas', ganada: false, terminada: false })
  })

  it('solo se gana acertando el quinto duelo', () => {
    const ronda = { referencia: carta('a', 100), retadora: carta('b', 150), duelo: DUELOS_POR_RONDA, aciertos: 4, vistos: new Set() }
    expect(resolver(ronda, 'mas')).toMatchObject({ acierto: true, ganada: true, terminada: true })
    expect(resolver(ronda, 'menos')).toMatchObject({ acierto: false, ganada: false, terminada: true })
    expect(resolver({ ...ronda, duelo: DUELOS_POR_RONDA - 1 }, 'mas')).toMatchObject({ ganada: false, terminada: false })
  })

  it('tras acertar, la retadora pasa a referencia y no se repite ninguna carta en la ronda', () => {
    const rng = crearAzar(11)
    const lista = conPopularidad()
    let ronda = nuevaRonda(rng, lista)
    for (let i = 1; i < DUELOS_POR_RONDA; i++) {
      const anterior = ronda
      ronda = siguienteDuelo(ronda, rng, lista)
      expect(ronda.referencia.id).toBe(anterior.retadora.id)
      expect(ronda.duelo).toBe(i + 1)
      expect(ronda.aciertos).toBe(i)
      expect(anterior.vistos.has(ronda.retadora.id)).toBe(false)
    }
    expect(ronda.vistos.size).toBe(DUELOS_POR_RONDA + 1)
  })
})

describe('inclinacion', () => {
  it('se inclina hacia la retadora si pesa más y hacia la referencia si no', () => {
    expect(inclinacion({ referencia: carta('a', 1000), retadora: carta('b', 2000) })).toBeGreaterThan(0)
    expect(inclinacion({ referencia: carta('a', 2000), retadora: carta('b', 1000) })).toBeLessThan(0)
  })

  it('va de la inclinación mínima (proporción 1,08) a la máxima (2,5), sin salirse', () => {
    expect(inclinacion({ referencia: carta('a', 1000), retadora: carta('b', 1080) })).toBeCloseTo(INCLINACION_MIN, 5)
    expect(inclinacion({ referencia: carta('a', 1000), retadora: carta('b', 2500) })).toBeCloseTo(INCLINACION_MAX, 5)
    expect(Math.abs(inclinacion({ referencia: carta('a', 1000), retadora: carta('b', 9000) }))).toBe(INCLINACION_MAX)
    const medio = inclinacion({ referencia: carta('a', 1000), retadora: carta('b', 1600) })
    expect(medio).toBeGreaterThan(INCLINACION_MIN)
    expect(medio).toBeLessThan(INCLINACION_MAX)
  })
})

describe('formatearFavs y valorContador', () => {
  it('separa los miles a la española', () => {
    expect(formatearFavs(12345)).toBe('12.345')
    expect(formatearFavs(999)).toBe('999')
  })

  it('el contador va de 0 al objetivo, frena al final y no se sale del rango', () => {
    expect(valorContador(1000, 0)).toBe(0)
    expect(valorContador(1000, 1)).toBe(1000)
    expect(valorContador(1000, 2)).toBe(1000)
    expect(valorContador(1000, -1)).toBe(0)
    expect(valorContador(1000, 0.5)).toBe(875)
  })
})

describe('pesasDeRacha', () => {
  it('numera las pesas y resume las que no caben', () => {
    expect(pesasDeRacha(0)).toEqual({ pesas: [], ocultas: 0 })
    expect(pesasDeRacha(3)).toEqual({ pesas: [1, 2, 3], ocultas: 0 })
    expect(pesasDeRacha(12, 10)).toEqual({ pesas: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ocultas: 2 })
  })
})

describe('récord guardado', () => {
  const memoria = () => {
    const datos = new Map()
    return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v), datos }
  }

  it('lee 0 si no hay nada, si está roto o si no hay almacenamiento', () => {
    expect(leerMejorRacha(memoria())).toBe(0)
    expect(leerMejorRacha(undefined)).toBe(0)
    const roto = memoria()
    roto.setItem(CLAVE_RECORD, '{no es json')
    expect(leerMejorRacha(roto)).toBe(0)
    roto.setItem(CLAVE_RECORD, JSON.stringify({ mejorRacha: -4 }))
    expect(leerMejorRacha(roto)).toBe(0)
    roto.setItem(CLAVE_RECORD, JSON.stringify({ mejorRacha: 'muchas' }))
    expect(leerMejorRacha(roto)).toBe(0)
  })

  it('guarda solo si mejora y devuelve el récord vigente', () => {
    const s = memoria()
    expect(guardarMejorRacha(s, 4)).toBe(4)
    expect(guardarMejorRacha(s, 2)).toBe(4)
    expect(guardarMejorRacha(s, 7)).toBe(7)
    expect(leerMejorRacha(s)).toBe(7)
    expect(s.datos.size).toBe(1)
  })

  it('si el almacenamiento falla al escribir, no rompe', () => {
    const s = {
      getItem: () => null,
      setItem: () => {
        throw new Error('sin cuota')
      },
    }
    expect(guardarMejorRacha(s, 3)).toBe(3)
  })
})
