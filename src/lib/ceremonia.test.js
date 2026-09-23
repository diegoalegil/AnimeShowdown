import { describe, expect, it } from 'vitest'
import {
  PASO_REVELADO_MS,
  cartasDelSobre,
  ceremonia,
  estadoInicial,
  formatoEspera,
  resumenSobre,
  textoAviso,
  textoResumen,
  todasReveladas,
  ultimoRetardo,
} from './ceremonia.js'

const IDS = ['a', 'b', 'a', 'c', 'e-x']
const CATALOGO = {
  a: { id: 'a', nombre: 'Frieren', anime: "Frieren: Beyond Journey's End" },
  b: { id: 'b', nombre: 'Fern', anime: "Frieren: Beyond Journey's End" },
  c: { id: 'c', nombre: 'Denji', anime: 'Chainsaw Man' },
  'e-x': { id: 'e-x', nombre: 'Makima', variante: 'Control', anime: 'Chainsaw Man' },
}
const ayudas = {
  carta: (id) => CATALOGO[id],
  copias: (id) => ({ a: 2, b: 4, c: 1, 'e-x': 1 })[id],
  esEspecial: (id) => id.startsWith('e-'),
}

const abierto = () => ceremonia(ceremonia(estadoInicial(), { tipo: 'abrir', ids: IDS, nuevas: ['a', 'c', 'e-x'] }), { tipo: 'abierto' })

describe('cartasDelSobre', () => {
  it('marca como nueva solo la primera aparición de cada carta nueva', () => {
    expect(cartasDelSobre(IDS, ['a', 'c', 'e-x'])).toEqual([
      { id: 'a', nueva: true },
      { id: 'b', nueva: false },
      { id: 'a', nueva: false },
      { id: 'c', nueva: true },
      { id: 'e-x', nueva: true },
    ])
  })
})

describe('ceremonia', () => {
  it('recorre cerrado → abriendo → abierto → guardando → cerrado', () => {
    let e = estadoInicial()
    e = ceremonia(e, { tipo: 'abrir', ids: IDS, nuevas: [] })
    expect(e).toMatchObject({ fase: 'abriendo', reveladas: [false, false, false, false, false], abiertosEnVisita: 1 })
    // Un segundo «abrir» mientras tanto no hace nada.
    expect(ceremonia(e, { tipo: 'abrir', ids: ['z'], nuevas: [] })).toBe(e)
    e = ceremonia(e, { tipo: 'abierto' })
    expect(e.fase).toBe('abierto')
    // No se guarda con cartas boca abajo.
    expect(ceremonia(e, { tipo: 'guardar' })).toBe(e)
    e = ceremonia(e, { tipo: 'revelarTodas' })
    e = ceremonia(e, { tipo: 'guardar' })
    expect(e.fase).toBe('guardando')
    e = ceremonia(e, { tipo: 'guardado' })
    expect(e).toMatchObject({ fase: 'cerrado', cartas: [], aviso: { tipo: 'guardado', n: 5 }, abiertosEnVisita: 1 })
  })

  it('voltea las cartas una a una y anuncia el resumen con la última', () => {
    let e = abierto()
    e = ceremonia(e, { tipo: 'revelar', indice: 2 })
    expect(e.reveladas).toEqual([false, false, true, false, false])
    expect(e.aviso).toEqual({ tipo: 'carta', indice: 2 })
    expect(ceremonia(e, { tipo: 'revelar', indice: 2 })).toBe(e)
    for (const i of [0, 1, 3]) e = ceremonia(e, { tipo: 'revelar', indice: i })
    expect(todasReveladas(e)).toBe(false)
    e = ceremonia(e, { tipo: 'revelar', indice: 4 })
    expect(todasReveladas(e)).toBe(true)
    expect(e.aviso).toEqual({ tipo: 'resumen', ultima: 4 })
  })

  it('«Revelar todas» escalona solo las que quedaban boca abajo', () => {
    let e = ceremonia(abierto(), { tipo: 'revelar', indice: 1 })
    e = ceremonia(e, { tipo: 'revelarTodas' })
    expect(e.retardos).toEqual([0, 0, PASO_REVELADO_MS, 2 * PASO_REVELADO_MS, 3 * PASO_REVELADO_MS])
    expect(ultimoRetardo(e)).toBe(3 * PASO_REVELADO_MS)
    expect(e.instantaneo).toBe(false)
  })

  it('«Saltar» va directo al resumen, sin animaciones, incluso a mitad de la apertura', () => {
    const e = ceremonia(ceremonia(estadoInicial(), { tipo: 'abrir', ids: IDS, nuevas: [] }), { tipo: 'saltar' })
    expect(e).toMatchObject({ fase: 'abierto', instantaneo: true, aviso: { tipo: 'resumen' } })
    expect(todasReveladas(e)).toBe(true)
    expect(ultimoRetardo(e)).toBe(0)
  })

  it('ignora acciones fuera de su fase', () => {
    const cerrado = estadoInicial()
    for (const tipo of ['abierto', 'revelarTodas', 'saltar', 'guardar', 'guardado', 'otra']) {
      expect(ceremonia(cerrado, { tipo, indice: 0 })).toBe(cerrado)
    }
  })
})

describe('textos', () => {
  it('resume nuevas, repetidas y especiales en castellano', () => {
    const cartas = cartasDelSobre(IDS, ['a', 'c', 'e-x'])
    expect(resumenSobre(cartas, ayudas.esEspecial)).toEqual({ nuevas: 3, repetidas: 2, especiales: 1 })
    expect(textoResumen({ nuevas: 3, repetidas: 2, especiales: 1 })).toBe('3 nuevas, 2 repetidas y 1 especial')
    expect(textoResumen({ nuevas: 1, repetidas: 4, especiales: 0 })).toBe('1 nueva y 4 repetidas')
    expect(textoResumen({ nuevas: 0, repetidas: 5, especiales: 2 })).toBe('5 repetidas y 2 especiales')
  })

  it('anuncia cada carta, el resumen y el guardado', () => {
    let e = abierto()
    expect(textoAviso(e, ayudas)).toBe('Sobre abierto: 5 cartas boca abajo. Pulsa cada una para darle la vuelta.')
    e = ceremonia(e, { tipo: 'revelar', indice: 4 })
    expect(textoAviso(e, ayudas)).toBe('Carta 5 de 5: Makima (Control), de Chainsaw Man. Especial. Nueva.')
    e = ceremonia(e, { tipo: 'revelar', indice: 1 })
    expect(textoAviso(e, ayudas)).toBe("Carta 2 de 5: Fern, de Frieren: Beyond Journey's End. Repetida: tienes 4.")
    e = ceremonia(e, { tipo: 'revelarTodas' })
    expect(textoAviso(e, ayudas)).toBe('Sobre revelado: 3 nuevas, 2 repetidas y 1 especial.')
    e = ceremonia(ceremonia(e, { tipo: 'guardar' }), { tipo: 'guardado' })
    expect(textoAviso(e, ayudas)).toBe('5 cartas guardadas en tu colección.')
    expect(textoAviso(estadoInicial(), ayudas)).toBe('')
  })

  it('escribe la espera hasta medianoche', () => {
    expect(formatoEspera(30_000)).toBe('menos de un minuto')
    expect(formatoEspera(60_000)).toBe('1 min')
    expect(formatoEspera(40 * 60_000 - 1)).toBe('40 min')
    expect(formatoEspera(5 * 3600_000 + 11 * 60_000 + 30_000)).toBe('5 h 12 min')
    expect(formatoEspera(2 * 3600_000)).toBe('2 h')
  })
})
