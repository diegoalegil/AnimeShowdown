import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { conPopularidad, PERSONAJES } from '../comun/cartas.js'
import {
  COLUMNAS,
  compararAnio,
  compararGenero,
  compararInicial,
  compararIntento,
  compararPopularidad,
  compararSerie,
  crearRanking,
  describirIntento,
  inicialDe,
  intentar,
  intentosRestantes,
  intentosUsados,
  letrasDe,
  MAX_INTENTOS,
  nuevaPartida,
  pedirPista,
  puedePedirPista,
  puntosDe,
  textoFicha,
  tonoDe,
  yaProbado,
} from './reglas.js'

// Cartas inventadas (sobre una serie real, para que tengan año): el ranking
// y las comparaciones no dependen del catálogo.
const SERIE = PERSONAJES[0].animeId
const carta = (id, extra = {}) => ({ id, nombre: id, anime: 'Serie', animeId: SERIE, genero: 'F', favs: 100, ...extra })
const LISTA = [
  carta('a', { favs: 1000 }),
  carta('b', { favs: 900 }),
  carta('c', { favs: 800 }),
  carta('d', { favs: 700 }),
  carta('e', { favs: 600 }),
  carta('f', { favs: 500 }),
  carta('g', { favs: 400 }),
  carta('h', { favs: 300 }),
  carta('i', { favs: 200 }),
  carta('j', { favs: 100 }),
]

describe('inicialDe y letrasDe', () => {
  it('toma la primera letra latina sin tildes y en mayúscula', () => {
    expect(inicialDe({ nombre: 'Éren Jaeger' })).toBe('E')
    expect(inicialDe({ nombre: 'levi' })).toBe('L')
    expect(inicialDe({ nombre: "'Kuchiki' Rukia" })).toBe('K')
    expect(inicialDe({ nombre: '' })).toBe('')
  })

  it('cuenta solo las letras, en su orden y con su grafía', () => {
    expect(letrasDe({ nombre: 'Ai Hoshino' })).toEqual(['A', 'i', 'H', 'o', 's', 'h', 'i', 'n', 'o'])
    expect(letrasDe({ nombre: 'L' })).toEqual(['L'])
    expect(letrasDe({ nombre: "D'Angelo-2" })).toEqual(['D', 'A', 'n', 'g', 'e', 'l', 'o'])
  })
})

describe('comparaciones', () => {
  it('inicial y serie', () => {
    expect(compararInicial({ nombre: 'Asuka' }, { nombre: 'Ángel' })).toBe('igual')
    expect(compararInicial({ nombre: 'Asuka' }, { nombre: 'Rei' })).toBe('distinta')
    expect(compararSerie({ animeId: 'x' }, { animeId: 'x' })).toBe('igual')
    expect(compararSerie({ animeId: 'x' }, { animeId: 'y' })).toBe('distinta')
  })

  it('género: desconocido si falta en cualquiera de los dos', () => {
    expect(compararGenero({ genero: 'F' }, { genero: 'F' })).toBe('igual')
    expect(compararGenero({ genero: 'F' }, { genero: 'M' })).toBe('distinto')
    expect(compararGenero({ genero: null }, { genero: 'M' })).toBe('desconocido')
    expect(compararGenero({ genero: 'F' }, {})).toBe('desconocido')
  })

  it('año: dice si el secreto es anterior o posterior, con el catálogo real', () => {
    const porAnime = new Map(PERSONAJES.map((c) => [c.animeId, c]))
    const [p1, p2] = [...porAnime.values()]
    expect(porAnime.size).toBeGreaterThan(1)
    expect(compararAnio(p1, p1)).toBe('igual')
    const directa = compararAnio(p1, p2)
    const inversa = compararAnio(p2, p1)
    if (directa === 'igual') expect(inversa).toBe('igual')
    else if (directa === 'desconocido') expect(inversa).toBe('desconocido')
    else expect(new Set([directa, inversa])).toEqual(new Set(['anterior', 'posterior']))
  })

  it('año: desconocido si la serie no tiene año', () => {
    expect(compararAnio({ animeId: 'no-existe' }, PERSONAJES[0])).toBe('desconocido')
  })

  it('popularidad: igual dentro de la tolerancia, si no dice hacia dónde', () => {
    const ranking = crearRanking(LISTA)
    expect(ranking.tolerancia).toBe(1) // ceil(10 × 5 %)
    expect(ranking.puesto.get('a')).toBe(0)
    expect(ranking.puesto.get('j')).toBe(9)
    expect(compararPopularidad(LISTA[0], LISTA[1], ranking)).toBe('igual')
    expect(compararPopularidad(LISTA[0], LISTA[0], ranking)).toBe('igual')
    expect(compararPopularidad(LISTA[5], LISTA[0], ranking)).toBe('mas')
    expect(compararPopularidad(LISTA[0], LISTA[5], ranking)).toBe('menos')
    expect(compararPopularidad(carta('sin-favs', { favs: 0 }), LISTA[0], ranking)).toBe('desconocido')
  })

  it('el ranking ordena por favoritos y desempata por id, de forma estable', () => {
    const r1 = crearRanking([carta('z', { favs: 5 }), carta('y', { favs: 5 }), carta('x', { favs: 9 })])
    expect([...r1.puesto.entries()]).toEqual([
      ['x', 0],
      ['y', 1],
      ['z', 2],
    ])
  })

  it('el ranking real cubre a todos los personajes con favoritos', () => {
    const ranking = crearRanking()
    expect(ranking.puesto.size).toBe(conPopularidad().length)
    expect(ranking.tolerancia).toBe(Math.ceil(conPopularidad().length * 0.05))
  })

  it('compararIntento junta las cinco fichas y marca el acierto', () => {
    const ranking = crearRanking(LISTA)
    const resultado = compararIntento(LISTA[2], LISTA[2], ranking)
    expect(resultado.acierto).toBe(true)
    for (const { clave } of COLUMNAS) expect(resultado[clave]).toBe('igual')
    const otro = compararIntento(carta('k', { animeId: 's2', genero: 'M', favs: 1 }), LISTA[0], ranking)
    expect(otro).toMatchObject({ acierto: false, inicial: 'distinta', serie: 'distinta', genero: 'distinto', popularidad: 'desconocido' })
  })
})

describe('tonoDe y textos', () => {
  it('oro si coincide, cian solo para la popularidad parecida, ceniza el resto', () => {
    expect(tonoDe('inicial', 'igual')).toBe('oro')
    expect(tonoDe('anio', 'igual')).toBe('oro')
    expect(tonoDe('popularidad', 'igual')).toBe('cian')
    expect(tonoDe('popularidad', 'mas')).toBe('ceniza')
    expect(tonoDe('genero', 'desconocido')).toBe('ceniza')
  })

  it('cada valor posible tiene un texto', () => {
    expect(textoFicha('anio', 'anterior')).toMatch(/anterior/)
    expect(textoFicha('popularidad', 'menos')).toMatch(/menos popular/)
    expect(textoFicha('genero', 'desconocido')).toMatch(/desconocido/)
    expect(textoFicha('nada', 'x')).toBe('')
  })

  it('describirIntento anuncia el acierto o las cinco comparaciones', () => {
    const ranking = crearRanking(LISTA)
    expect(describirIntento(compararIntento(LISTA[0], LISTA[0], ranking), 1)).toMatch(/^Intento 1, a: ¡es el personaje secreto!$/)
    const texto = describirIntento(compararIntento(LISTA[0], LISTA[9], ranking), 2)
    expect(texto).toMatch(/^Intento 2, a: /)
    expect(texto.split(', ')).toHaveLength(6)
  })
})

describe('partida', () => {
  const rng = () => 0.5

  it('empieza vacía, con un secreto de la lista y fuera de los excluidos', () => {
    const partida = nuevaPartida(crearAzar(3), { lista: LISTA })
    expect(LISTA).toContain(partida.secreto)
    expect(partida.intentos).toEqual([])
    expect(partida.pista).toBeNull()
    expect(partida.fin).toBeNull()
    expect(intentosRestantes(partida)).toBe(MAX_INTENTOS)

    const excluir = new Set(LISTA.slice(1).map((c) => c.id))
    expect(nuevaPartida(crearAzar(9), { lista: LISTA, excluir }).secreto.id).toBe('a')
    // Si se excluye todo, vuelve a la lista entera en vez de quedarse sin secreto.
    expect(nuevaPartida(crearAzar(9), { lista: LISTA, excluir: new Set(LISTA.map((c) => c.id)) }).secreto).toBeDefined()
  })

  it('con semilla, la misma partida sale igual', () => {
    expect(nuevaPartida(crearAzar('anigrid:1'), { lista: LISTA }).secreto).toBe(nuevaPartida(crearAzar('anigrid:1'), { lista: LISTA }).secreto)
  })

  it('el secreto real siempre tiene popularidad', () => {
    const partida = nuevaPartida(crearAzar(11))
    expect(partida.secreto.favs).toBeGreaterThan(0)
  })

  it('gana al acertar y no admite más intentos después', () => {
    let partida = nuevaPartida(rng, { lista: LISTA })
    const otro = LISTA.find((c) => c.id !== partida.secreto.id)
    partida = intentar(partida, otro)
    expect(partida.fin).toBeNull()
    expect(intentosUsados(partida)).toBe(1)
    partida = intentar(partida, partida.secreto)
    expect(partida.fin).toBe('victoria')
    expect(partida.intentos.at(-1).acierto).toBe(true)
    expect(puntosDe(partida)).toBe(50)
    const despues = intentar(partida, LISTA[9])
    expect(despues).toBe(partida)
  })

  it('ignora los personajes repetidos', () => {
    let partida = nuevaPartida(rng, { lista: LISTA })
    const otro = LISTA.find((c) => c.id !== partida.secreto.id)
    partida = intentar(partida, otro)
    expect(yaProbado(partida, otro)).toBe(true)
    expect(intentar(partida, otro)).toBe(partida)
  })

  it('pierde al sexto fallo y no da puntos', () => {
    let partida = nuevaPartida(rng, { lista: LISTA })
    const fallos = LISTA.filter((c) => c.id !== partida.secreto.id)
    for (let i = 0; i < MAX_INTENTOS; i++) {
      expect(partida.fin).toBeNull()
      partida = intentar(partida, fallos[i])
    }
    expect(partida.fin).toBe('derrota')
    expect(intentosRestantes(partida)).toBe(0)
    expect(puntosDe(partida)).toBe(0)
    expect(intentar(partida, partida.secreto)).toBe(partida)
  })

  it('acertar justo al sexto intento sigue siendo victoria', () => {
    let partida = nuevaPartida(rng, { lista: LISTA })
    const fallos = LISTA.filter((c) => c.id !== partida.secreto.id)
    for (let i = 0; i < MAX_INTENTOS - 1; i++) partida = intentar(partida, fallos[i])
    partida = intentar(partida, partida.secreto)
    expect(partida.fin).toBe('victoria')
    expect(puntosDe(partida)).toBe(10)
  })
})

describe('pista', () => {
  const rng = () => 0.5
  const LARGOS = LISTA.map((c) => ({ ...c, nombre: `${c.id}bcdef` }))

  it('revela una letra que no es la primera y cuesta un intento', () => {
    let partida = nuevaPartida(rng, { lista: LARGOS })
    expect(puedePedirPista(partida)).toBe(true)
    partida = pedirPista(partida, crearAzar(5))
    expect(partida.pista).toMatchObject({ total: 6 })
    expect(partida.pista.posicion).toBeGreaterThanOrEqual(2)
    expect(partida.pista.posicion).toBeLessThanOrEqual(6)
    expect(partida.pista.letra).toBe(letrasDe(partida.secreto)[partida.pista.posicion - 1])
    expect(intentosUsados(partida)).toBe(1)
    expect(intentosRestantes(partida)).toBe(MAX_INTENTOS - 1)
    // Solo una vez.
    expect(puedePedirPista(partida)).toBe(false)
    expect(pedirPista(partida, rng)).toBe(partida)
  })

  it('con semilla siempre cae en la misma letra, y nunca en la primera', () => {
    const partida = nuevaPartida(rng, { lista: LARGOS })
    const posiciones = new Set()
    for (let s = 0; s < 200; s++) {
      const con = pedirPista(partida, crearAzar(s))
      expect(con.pista.posicion).not.toBe(1)
      posiciones.add(con.pista.posicion)
    }
    expect(posiciones.size).toBe(5)
    expect(pedirPista(partida, crearAzar(42)).pista).toEqual(pedirPista(partida, crearAzar(42)).pista)
  })

  it('no se puede con nombres de una letra ni cuando queda un solo intento', () => {
    const corto = nuevaPartida(rng, { lista: [carta('L')] })
    expect(puedePedirPista(corto)).toBe(false)

    let partida = nuevaPartida(rng, { lista: LARGOS })
    const fallos = LARGOS.filter((c) => c.id !== partida.secreto.id)
    for (let i = 0; i < MAX_INTENTOS - 1; i++) partida = intentar(partida, fallos[i])
    expect(intentosRestantes(partida)).toBe(1)
    expect(puedePedirPista(partida)).toBe(false)
  })

  it('la pista cuenta para la derrota: cinco fallos más pista agotan la ronda', () => {
    let partida = pedirPista(nuevaPartida(rng, { lista: LARGOS }), rng)
    const fallos = LARGOS.filter((c) => c.id !== partida.secreto.id)
    for (let i = 0; i < MAX_INTENTOS - 1; i++) partida = intentar(partida, fallos[i])
    expect(partida.fin).toBe('derrota')
    expect(intentosUsados(partida)).toBe(MAX_INTENTOS)
  })

  it('acertar con pista da los puntos de un intento menos', () => {
    let partida = pedirPista(nuevaPartida(rng, { lista: LARGOS }), rng)
    partida = intentar(partida, partida.secreto)
    expect(puntosDe(partida)).toBe(50)
  })
})
