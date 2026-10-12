import { describe, expect, it } from 'vitest'
import { PERSONAJES } from '../comun/cartas.js'
import {
  CLAVE_GUARDADO,
  HUECOS,
  altarVacio,
  anadir,
  cartasDe,
  completo,
  guardarAltar,
  leerAltar,
  mover,
  ocupados,
  quitar,
  sanearAltar,
} from './reglas.js'

const ids = PERSONAJES.slice(0, 7).map((c) => c.id)

/** Storage en memoria con la interfaz de localStorage. */
function storageFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    datos,
  }
}

describe('sanearAltar', () => {
  it('devuelve cinco huecos vacíos ante datos rotos', () => {
    for (const bruto of [null, 'x', 3, {}, { altar: 'no' }, [1, 2, 3]]) {
      expect(sanearAltar(bruto)).toEqual(altarVacio())
    }
  })

  it('quita ids desconocidos y repetidos, compacta y corta en cinco', () => {
    const altar = sanearAltar([ids[0], 'no-existe', ids[0], null, ids[1], ids[2], ids[3], ids[4], ids[5]])
    expect(altar).toEqual(ids.slice(0, 5))
    expect(altar).toHaveLength(HUECOS)
  })

  it('acepta el objeto guardado { v, altar }', () => {
    expect(sanearAltar({ v: 1, altar: [ids[1]] })).toEqual([ids[1], null, null, null, null])
  })
})

describe('anadir, quitar y mover', () => {
  it('añade al primer hueco libre y dice el puesto', () => {
    const a = anadir(altarVacio(), ids[0])
    expect(a.puesto).toBe(1)
    const b = anadir(a.altar, ids[1])
    expect(b.puesto).toBe(2)
    expect(ocupados(b.altar)).toEqual([ids[0], ids[1]])
  })

  it('rechaza repetidos y el altar lleno sin tocar el altar', () => {
    const lleno = sanearAltar(ids.slice(0, 5))
    expect(anadir(lleno, ids[0]).error).toMatch(/ya está/)
    expect(anadir(lleno, ids[0]).altar).toBe(lleno)
    expect(anadir(lleno, ids[6]).error).toMatch(/completo/)
    expect(completo(lleno)).toBe(true)
    expect(completo(altarVacio())).toBe(false)
  })

  it('quitar compacta los huecos hacia el principio', () => {
    const altar = sanearAltar(ids.slice(0, 3))
    expect(quitar(altar, ids[1])).toEqual([ids[0], ids[2], null, null, null])
    expect(quitar(altar, 'nadie')).toEqual(altar)
  })

  it('mover intercambia vecinos y no sale del altar ni pisa huecos', () => {
    const altar = sanearAltar(ids.slice(0, 3))
    expect(mover(altar, 0, 1)).toEqual([ids[1], ids[0], ids[2], null, null])
    expect(mover(altar, 2, 0)).toEqual([ids[2], ids[1], ids[0], null, null])
    expect(mover(altar, 0, -1)).toBe(altar)
    expect(mover(altar, 2, 3)).toBe(altar) // el puesto 4 está vacío
    expect(mover(altar, 4, 5)).toBe(altar)
    expect(mover(altar, 1, 1)).toBe(altar)
  })

  it('cartasDe resuelve las cartas del catálogo en orden', () => {
    const cartas = cartasDe(sanearAltar([ids[1], ids[0]]))
    expect(cartas[0].id).toBe(ids[1])
    expect(cartas[1].nombre).toBe(PERSONAJES[0].nombre)
    expect(cartas[2]).toBeNull()
  })
})

describe('guardado', () => {
  it('guarda y lee bajo su clave; sin storage o con basura devuelve el altar vacío', () => {
    const storage = storageFalso()
    guardarAltar(sanearAltar([ids[2], ids[3]]), storage)
    expect(JSON.parse(storage.datos.get(CLAVE_GUARDADO))).toEqual({ v: 1, altar: [ids[2], ids[3], null, null, null] })
    expect(leerAltar(storage)).toEqual([ids[2], ids[3], null, null, null])
    expect(leerAltar(storageFalso({ [CLAVE_GUARDADO]: '{rota' }))).toEqual(altarVacio())
    expect(leerAltar(undefined)).toEqual(altarVacio())
    expect(() => guardarAltar(altarVacio(), { setItem: () => { throw new Error('lleno') } })).not.toThrow()
  })
})
