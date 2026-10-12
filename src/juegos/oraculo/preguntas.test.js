import { describe, expect, it } from 'vitest'
import { PERSONAJES } from '../comun/cartas.js'
import { banco, crearBanco, franquiciaDe, primerNombre } from './preguntas.js'

const SERIES = {
  fz: { id: 'fz', titulo: 'Fate/Zero', anio: 2011, episodios: 13, generos: ['Action', 'Fantasy'] },
  fs: { id: 'fs', titulo: 'Fate/Stay Night', anio: 2006, episodios: 24, generos: ['Action', 'Romance'] },
  op: { id: 'op', titulo: 'One Piece', anio: 1999, generos: ['Adventure'] },
  vo: { id: 'vo', titulo: 'Vocaloid' },
}
const CARTAS = [
  { id: 'saber', nombre: 'Saber', animeId: 'fz', genero: 'F', favs: 9000, nativo: 'セイバー', cumple: '01-15' },
  { id: 'kiritsugu', nombre: 'Kiritsugu Emiya', animeId: 'fz', genero: 'M', favs: 3000, nativo: '衛宮切嗣', cumple: '11-01' },
  { id: 'shirou', nombre: 'Shirou Emiya', animeId: 'fs', genero: 'M', favs: 500, nativo: '衛宮士郎' },
  { id: 'luffy', nombre: 'Luffy', animeId: 'op', genero: 'M', favs: 90000, nativo: 'ルフィ', cumple: '05-05' },
  { id: 'miku', nombre: 'Miku', animeId: 'vo', genero: null, nativo: '初音ミク', cumple: '08-31' },
  { id: 'anon', nombre: 'Anónimo Sin Datos', animeId: 'vo' },
]
const opciones = { serie: (c) => SERIES[c.animeId], especial: (c) => c.id === 'saber' }
const pregunta = (lista, id) => lista.find((p) => p.id === id)
const respuestas = (lista, id) => CARTAS.map((c) => pregunta(lista, id).aplica(c))

describe('crearBanco', () => {
  const lista = crearBanco(CARTAS, opciones)

  it('pregunta por el género y devuelve null si falta el dato', () => {
    expect(respuestas(lista, 'genero')).toEqual([true, false, false, false, null, null])
  })

  it('pregunta por cada serie y por las franquicias con más de una serie', () => {
    expect(pregunta(lista, 'serie:fz').texto).toBe('¿Es de Fate/Zero?')
    expect(respuestas(lista, 'serie:fz')).toEqual([true, true, false, false, false, false])
    expect(pregunta(lista, 'franquicia:Fate').texto).toBe('¿Es de la franquicia Fate?')
    expect(respuestas(lista, 'franquicia:Fate')).toEqual([true, true, true, false, false, false])
    expect(pregunta(lista, 'franquicia:One Piece')).toBeUndefined()
  })

  it('traduce los géneros de la serie y no sabe nada de una serie sin ellos', () => {
    expect(pregunta(lista, 'genero-serie:Action').texto).toBe('¿Su serie es de acción?')
    expect(respuestas(lista, 'genero-serie:Action')).toEqual([true, true, true, false, null, null])
    expect(pregunta(lista, 'genero-serie:Mecha')).toBeUndefined()
  })

  it('década y episodios salen de la serie; sin dato, null', () => {
    expect(respuestas(lista, 'decada:2010')).toEqual([true, true, false, false, null, null])
    expect(respuestas(lista, 'decada:xx')).toEqual([false, false, false, true, null, null])
    expect(respuestas(lista, 'episodios:12')).toEqual([true, true, true, null, null, null])
    expect(respuestas(lista, 'episodios:26')).toEqual([false, false, false, null, null, null])
  })

  it('los tramos de popularidad se calculan entre los que tienen favoritos', () => {
    // Cuatro con favs: Luffy, Saber, Kiritsugu, Shirou. Top 25 % = 1; mitad = 2.
    expect(respuestas(lista, 'popularidad:top25')).toEqual([false, false, false, true, null, null])
    expect(respuestas(lista, 'popularidad:top50')).toEqual([true, false, false, true, null, null])
  })

  it('el nombre: inicial, longitud, apellido y escritura japonesa', () => {
    expect(respuestas(lista, 'inicial:vocal')).toEqual([false, false, false, false, false, true])
    expect(respuestas(lista, 'inicial:s')).toEqual([true, false, true, false, false, false])
    expect(respuestas(lista, 'nombre:largo')).toEqual([false, true, true, false, false, true])
    expect(respuestas(lista, 'nombre:apellido')).toEqual([false, true, true, false, false, true])
    expect(respuestas(lista, 'nativo:katakana')).toEqual([true, false, false, true, false, null])
    expect(respuestas(lista, 'nativo:kanji')).toEqual([false, true, true, false, true, null])
  })

  it('versión especial y estación del cumpleaños', () => {
    expect(respuestas(lista, 'especial')).toEqual([true, false, false, false, false, false])
    expect(respuestas(lista, 'cumple:invierno')).toEqual([true, false, null, false, false, null])
    expect(respuestas(lista, 'cumple:verano')).toEqual([false, false, null, false, true, null])
    expect(respuestas(lista, 'cumple:primer-semestre')).toEqual([true, false, null, true, false, null])
  })

  it('cada pregunta tiene id único, tipo y texto en forma de pregunta', () => {
    expect(new Set(lista.map((p) => p.id)).size).toBe(lista.length)
    for (const p of lista) {
      expect(p.tipo).toBeTruthy()
      expect(p.texto).toMatch(/^¿.+\?$/)
    }
  })
})

describe('ayudas', () => {
  it('primerNombre quita tildes, apellidos y signos', () => {
    expect(primerNombre({ nombre: "Ryūji D'Aragon Jr." })).toBe('ryuji')
    expect(primerNombre({ nombre: ' Érina  Nakiri ' })).toBe('erina')
  })

  it('franquiciaDe corta en «/» o «:»', () => {
    expect(franquiciaDe({ titulo: 'Fate/Grand Order' })).toBe('Fate')
    expect(franquiciaDe({ titulo: 'Re:Zero' })).toBe('Re')
    expect(franquiciaDe({ titulo: 'Naruto' })).toBe('Naruto')
  })
})

describe('banco del catálogo', () => {
  it('se construye una vez, es amplio y solo contesta true, false o null', () => {
    const lista = banco()
    expect(banco()).toBe(lista)
    expect(lista.length).toBeGreaterThan(100)
    const muestra = PERSONAJES.filter((_, i) => i % 50 === 0)
    for (const p of lista) for (const c of muestra) expect([true, false, null]).toContain(p.aplica(c))
  })
})
