import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { PERSONAJES } from '../comun/cartas.js'
import { banco as bancoCatalogo, crearBanco } from './preguntas.js'
import {
  MAX_APUESTAS,
  MAX_NO_SE,
  MAX_PREGUNTAS,
  cicloAura,
  confianza,
  continuar,
  elegirPregunta,
  esSincera,
  filtrar,
  ganada,
  ganancia,
  mejorCandidato,
  nuevaPartida,
  peso,
  responder,
} from './reglas.js'

// Un catálogo pequeño: dos series, un personaje sin datos y otro muy popular.
const SERIES = {
  a: { id: 'a', titulo: 'Alfa', anio: 2015, episodios: 12, generos: ['Action'] },
  b: { id: 'b', titulo: 'Beta', anio: 2001, episodios: 50, generos: ['Romance'] },
}
const CARTAS = [
  { id: 'ana', nombre: 'Ana', animeId: 'a', genero: 'F', favs: 100, nativo: 'アナ', cumple: '02-02' },
  { id: 'bruno', nombre: 'Bruno', animeId: 'a', genero: 'M', favs: 5000, nativo: '武', cumple: '07-07' },
  { id: 'carla', nombre: 'Carla', animeId: 'b', genero: 'F', favs: 20, nativo: 'カルラ' },
  { id: 'dani', nombre: 'Dani', animeId: 'b', genero: 'M', favs: 80000, nativo: 'ダニ', cumple: '10-10' },
  { id: 'eco', nombre: 'Eco', animeId: 'b' },
]
const BANCO = crearBanco(CARTAS, { serie: (c) => SERIES[c.animeId], especial: () => false })
const carta = (id) => CARTAS.find((c) => c.id === id)
const GENERO = BANCO.find((p) => p.id === 'genero')
const SERIE_A = BANCO.find((p) => p.id === 'serie:a')

/** Juega con sinceridad (y «no sé» en las preguntas que diga `dudas`) hasta que acabe. */
function jugar(sellado, { rng = crearAzar(1), dudas = new Set(), lista = CARTAS, banco = BANCO } = {}) {
  let p = nuevaPartida(sellado, { banco, candidatos: lista, rng })
  const pasos = [p]
  for (let i = 0; i < 60 && !p.resultado; i++) {
    if (p.fase === 'pregunta') {
      const v = p.pregunta.aplica(sellado)
      const respuesta = dudas.has(p.respuestas.length) ? 'nose' : v === null ? 'si' : v ? 'si' : 'no'
      p = responder(p, respuesta, rng)
    } else p = continuar(p, rng)
    pasos.push(p)
  }
  return { final: p, pasos }
}

describe('peso, confianza y mejor candidato', () => {
  it('el peso crece con los favoritos en escala logarítmica y vale 1 sin dato', () => {
    expect(peso(carta('eco'))).toBe(1)
    expect(peso(carta('dani'))).toBeGreaterThan(peso(carta('bruno')))
    expect(peso(carta('dani'))).toBeLessThan(6)
  })

  it('la confianza es el peso del mejor sobre el total; con uno solo es 1 y sin nadie 0', () => {
    expect(confianza([])).toBe(0)
    expect(confianza([carta('ana')])).toBe(1)
    const c = confianza(CARTAS)
    expect(c).toBeGreaterThan(0.2)
    expect(c).toBeLessThan(0.5)
    expect(mejorCandidato(CARTAS)).toBe(carta('dani'))
    expect(mejorCandidato([])).toBeUndefined()
  })

  it('cicloAura va de 4 s (sin confianza) a 1,5 s (segura), acotado', () => {
    expect(cicloAura(0)).toBe('4.00s')
    expect(cicloAura(0.6)).toBe('2.50s')
    expect(cicloAura(1)).toBe('1.50s')
    expect(cicloAura(7)).toBe('1.50s')
    expect(cicloAura(-1)).toBe('4.00s')
  })
})

describe('ganancia, filtrado y sinceridad', () => {
  it('una pregunta que no parte a los candidatos no gana nada', () => {
    expect(ganancia(SERIE_A, [carta('ana'), carta('bruno')])).toBe(0)
    expect(ganancia(GENERO, [carta('eco')])).toBe(0)
  })

  it('un reparto equilibrado gana más que uno desigual, y los «no se sabe» restan', () => {
    const iguales = [carta('ana'), carta('eco')].map((c) => ({ ...c, favs: 0 }))
    const sinDato = { ...carta('eco'), id: 'x', favs: 0 }
    const equilibrado = ganancia(SERIE_A, [{ ...carta('ana'), favs: 0 }, { ...carta('carla'), favs: 0 }])
    expect(equilibrado).toBeCloseTo(0.5, 5)
    expect(ganancia(SERIE_A, [...iguales, { ...carta('carla'), favs: 0 }])).toBeLessThan(equilibrado)
    expect(ganancia(GENERO, [{ ...carta('ana'), favs: 0 }, { ...carta('bruno'), favs: 0 }, sinDato])).toBeLessThan(equilibrado)
  })

  it('filtrar conserva a los que no se sabe y «no sé» no descarta a nadie', () => {
    expect(filtrar(CARTAS, GENERO, 'si').map((c) => c.id)).toEqual(['ana', 'carla', 'eco'])
    expect(filtrar(CARTAS, GENERO, 'no').map((c) => c.id)).toEqual(['bruno', 'dani', 'eco'])
    expect(filtrar(CARTAS, GENERO, 'nose')).toBe(CARTAS)
  })

  it('esSincera compara con los datos; sin dato, todo vale', () => {
    expect(esSincera(GENERO, carta('ana'), 'si')).toBe(true)
    expect(esSincera(GENERO, carta('ana'), 'no')).toBe(false)
    expect(esSincera(GENERO, carta('ana'), 'nose')).toBe(true)
    expect(esSincera(GENERO, carta('eco'), 'si')).toBe(true)
    expect(esSincera(GENERO, carta('eco'), 'no')).toBe(true)
  })

  it('elegirPregunta evita las hechas, prefiere las que más parten y es determinista con semilla', () => {
    const hechas = new Set(BANCO.map((p) => p.id).filter((id) => id !== 'genero'))
    expect(elegirPregunta(BANCO, CARTAS, hechas, crearAzar(1))).toBe(GENERO)
    expect(elegirPregunta(BANCO, CARTAS, new Set(BANCO.map((p) => p.id)), crearAzar(1))).toBeUndefined()
    expect(elegirPregunta(BANCO, [carta('eco')], new Set(), crearAzar(1))).toBeUndefined()
    const a = elegirPregunta(BANCO, CARTAS, new Set(), crearAzar(42))
    const b = elegirPregunta(BANCO, CARTAS, new Set(), crearAzar(42))
    expect(a).toBe(b)
    expect(ganancia(a, CARTAS)).toBeGreaterThan(0)
  })
})

describe('la partida', () => {
  it('empieza preguntando, el sellado sigue siempre entre los candidatos y acaba con un resultado', () => {
    const { final, pasos } = jugar(carta('carla'))
    expect(pasos[0].fase).toBe('pregunta')
    for (const p of pasos) if (p.fase !== 'fin') expect(p.candidatos).toContain(carta('carla'))
    expect(final.fase).toBe('fin')
    expect(['adivinado', 'enganado']).toContain(final.resultado)
    expect(final.respuestas.length).toBeLessThanOrEqual(MAX_PREGUNTAS)
    expect(final.apuestas.length).toBeLessThanOrEqual(MAX_APUESTAS)
    expect(final.mentira).toBeNull()
  })

  it('con sinceridad total el oráculo acierta al personaje de datos únicos', () => {
    const { final } = jugar(carta('ana'))
    expect(final.resultado).toBe('adivinado')
    expect(final.apuesta).toBe(carta('ana'))
    expect(final.acierto).toBe(true)
    expect(ganada(final)).toBe(false)
  })

  it('una mentira acaba la partida al instante y dice en qué se mintió', () => {
    let p = nuevaPartida(carta('ana'), { banco: [GENERO], candidatos: CARTAS, rng: crearAzar(1) })
    expect(p.pregunta).toBe(GENERO)
    p = responder(p, 'no')
    expect(p.fase).toBe('fin')
    expect(p.resultado).toBe('mentira')
    expect(p.mentira).toEqual({ pregunta: GENERO, respuesta: 'no', verdad: true })
    expect(ganada(p)).toBe(false)
    // Terminada, no admite más respuestas.
    expect(responder(p, 'si')).toBe(p)
  })

  it('«no sé» no descarta, cuenta hasta el tope y después se ignora', () => {
    let p = nuevaPartida(carta('eco'), { banco: BANCO, candidatos: CARTAS, rng: crearAzar(2) })
    for (let i = 0; i < MAX_NO_SE; i++) {
      const antes = p.candidatos
      p = responder(p, 'nose', crearAzar(2))
      expect(p.candidatos).toBe(antes)
    }
    expect(p.noSe).toBe(MAX_NO_SE)
    expect(p.fase).toBe('pregunta')
    expect(responder(p, 'nose')).toBe(p)
  })

  it('sin preguntas útiles apuesta; falla, sigue tras continuar y a la segunda apuesta fallida gana el jugador', () => {
    // Solo el género: tras responderlo quedan Bruno, Dani y Eco (sin dato).
    let p = nuevaPartida(carta('eco'), { banco: [GENERO], candidatos: CARTAS, rng: crearAzar(1) })
    p = responder(p, 'no')
    expect(p.fase).toBe('veredicto')
    expect(p.apuesta).toBe(carta('dani'))
    expect(p.acierto).toBe(false)
    expect(p.resultado).toBeNull()
    expect(p.candidatos.map((c) => c.id)).toEqual(['bruno', 'eco'])
    // Sin más preguntas, continuar lleva a la segunda apuesta.
    p = continuar(p)
    expect(p.fase).toBe('fin')
    expect(p.apuesta).toBe(carta('bruno'))
    expect(p.apuestas.map((c) => c.id)).toEqual(['dani', 'bruno'])
    expect(p.resultado).toBe('enganado')
    expect(ganada(p)).toBe(true)
    expect(continuar(p)).toBe(p)
  })

  it('apuesta en cuanto queda un candidato o está segura', () => {
    let p = nuevaPartida(carta('ana'), { banco: [GENERO, SERIE_A], candidatos: [carta('ana'), carta('bruno')], rng: crearAzar(1) })
    expect(p.pregunta).toBe(GENERO)
    p = responder(p, 'si')
    expect(p.fase).toBe('fin')
    expect(p.resultado).toBe('adivinado')
    expect(p.respuestas).toHaveLength(1)
  })

  it('no pasa de MAX_PREGUNTAS aunque queden preguntas útiles, y luego apuesta', () => {
    // Treinta clones sin datos y treinta preguntas que cada una solo descarta a uno.
    const clones = Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, nombre: `V${i}`, animeId: 'b' }))
    const lista = [carta('ana'), carta('eco'), ...clones]
    const preguntas = clones.map((v, i) => ({
      id: `descarta:${i}`,
      tipo: 'prueba',
      texto: `¿Pregunta ${i}?`,
      aplica: (c) => (c.id === 'ana' ? true : c.id === v.id ? false : null),
    }))
    const { final } = jugar(carta('eco'), { banco: preguntas, lista, rng: crearAzar(9) })
    expect(final.respuestas).toHaveLength(MAX_PREGUNTAS)
    expect(final.apuestas.map((c) => c.id)).toEqual(['ana', 'eco'])
    expect(final.resultado).toBe('adivinado')
  })

  it('la misma semilla reproduce la misma partida sobre el catálogo real', () => {
    const sellado = PERSONAJES[7]
    const a = jugar(sellado, { rng: crearAzar(11), lista: PERSONAJES, banco: bancoCatalogo(), dudas: new Set([0, 3]) })
    const b = jugar(sellado, { rng: crearAzar(11), lista: PERSONAJES, banco: bancoCatalogo(), dudas: new Set([0, 3]) })
    expect(a.final.respuestas.map((r) => r.pregunta.id)).toEqual(b.final.respuestas.map((r) => r.pregunta.id))
    expect(a.final.resultado).toBe(b.final.resultado)
    expect(a.final.noSe).toBe(2)
    expect(a.final.respuestas.length).toBeLessThanOrEqual(MAX_PREGUNTAS)
  })
})
