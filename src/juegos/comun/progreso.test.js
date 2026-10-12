import { describe, expect, it, vi } from 'vitest'
import { SLUGS } from '../registro.js'
import {
  anotarRonda,
  CLAVE_PROGRESO,
  crearAlmacenProgreso,
  progresoDe,
  progresoVacio,
  sanearProgreso,
  SIN_JUGAR,
  totales,
} from './progreso.js'

/** Storage en memoria con la interfaz de localStorage. */
function storageFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    datos,
  }
}

describe('sanearProgreso', () => {
  it('devuelve un progreso vacío ante datos rotos o de otra versión', () => {
    for (const bruto of [null, 'x', 3, [], { v: 2, juegos: {} }, { juegos: {} }]) {
      expect(sanearProgreso(bruto)).toEqual(progresoVacio())
    }
  })

  it('conserva solo juegos conocidos y arregla cuentas incoherentes', () => {
    const progreso = sanearProgreso(
      {
        v: 1,
        juegos: {
          silueta: { racha: 3, record: 1, jugadas: 2, ganadas: 5, mejor: -4 },
          nexo: 'nada',
          inventado: { racha: 9, record: 9, jugadas: 9, ganadas: 9 },
          anigrid: { racha: 1.5, record: '2', jugadas: null },
        },
        sobres: 7.5,
      },
      ['silueta', 'nexo', 'anigrid'],
    )
    // El récord nunca es menor que la racha, ni las ganadas más que las jugadas.
    expect(progreso.juegos.silueta).toEqual({ racha: 3, record: 3, jugadas: 2, ganadas: 2, mejor: 0 })
    expect(progreso.juegos.nexo).toEqual(SIN_JUGAR)
    expect(progreso.juegos.anigrid).toEqual(SIN_JUGAR)
    expect(progreso.juegos.inventado).toBeUndefined()
    expect(progreso.sobres).toBe(0)
  })

  it('por defecto conoce los juegos del registro', () => {
    const juegos = Object.fromEntries(SLUGS.map((slug) => [slug, { racha: 1, record: 1, jugadas: 1, ganadas: 1, mejor: 0 }]))
    expect(Object.keys(sanearProgreso({ v: 1, juegos, sobres: 2 }).juegos)).toEqual(SLUGS)
  })
})

describe('anotarRonda', () => {
  it('alarga la racha al ganar, la corta al perder y guarda el récord y la mejor puntuación', () => {
    let p = progresoVacio()
    expect(progresoDe(p, 'silueta')).toBe(SIN_JUGAR)
    p = anotarRonda(p, 'silueta', { ganada: true, puntos: 40, sobre: true })
    p = anotarRonda(p, 'silueta', { ganada: true, puntos: 25.7, sobre: true })
    expect(progresoDe(p, 'silueta')).toEqual({ racha: 2, record: 2, jugadas: 2, ganadas: 2, mejor: 40 })
    expect(p.sobres).toBe(2)
    p = anotarRonda(p, 'silueta', { ganada: false })
    expect(progresoDe(p, 'silueta')).toEqual({ racha: 0, record: 2, jugadas: 3, ganadas: 2, mejor: 40 })
    expect(p.sobres).toBe(2)
    p = anotarRonda(p, 'silueta', { ganada: true, puntos: Number.NaN })
    expect(progresoDe(p, 'silueta')).toMatchObject({ racha: 1, record: 2, mejor: 40 })
    // Otro juego lleva su propia cuenta; el progreso anterior no se modifica.
    const q = anotarRonda(p, 'nexo', { ganada: true })
    expect(progresoDe(q, 'nexo')).toMatchObject({ racha: 1, jugadas: 1 })
    expect(progresoDe(p, 'nexo')).toBe(SIN_JUGAR)
    expect(totales(q)).toEqual({ jugadas: 5, ganadas: 4, sobres: 2 })
  })
})

describe('crearAlmacenProgreso', () => {
  it('guarda en localStorage, avisa a los suscriptores y rechaza juegos desconocidos', () => {
    const storage = storageFalso()
    const almacen = crearAlmacenProgreso({ storage: () => storage })
    const oyente = vi.fn()
    almacen.subscribe(oyente)
    expect(almacen.getSnapshot()).toEqual(progresoVacio())
    expect(almacen.anotarRonda('impostor', { ganada: true, sobre: true })).toEqual({ racha: 1, record: 1, jugadas: 1, ganadas: 1, mejor: 0 })
    expect(oyente).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.datos.get(CLAVE_PROGRESO))).toMatchObject({ v: 1, juegos: { impostor: { racha: 1 } }, sobres: 1 })
    expect(() => almacen.anotarRonda('inventado', { ganada: true })).toThrow('Juego desconocido')
    // Recupera lo guardado y lo sanea al leer.
    const otro = crearAlmacenProgreso({ storage: () => storage })
    expect(progresoDe(otro.getSnapshot(), 'impostor').jugadas).toBe(1)
    expect(crearAlmacenProgreso({ storage: () => storageFalso({ [CLAVE_PROGRESO]: '{roto' }) }).getSnapshot()).toEqual(progresoVacio())
  })

  it('se entera de los cambios hechos desde otra pestaña y funciona sin localStorage', () => {
    const storage = storageFalso()
    const oyentes = new Map()
    const ventana = { addEventListener: (t, f) => oyentes.set(t, f), removeEventListener: (t) => oyentes.delete(t) }
    const almacen = crearAlmacenProgreso({ storage: () => storage, ventana })
    const soltar = almacen.subscribe(() => {})
    storage.setItem(CLAVE_PROGRESO, JSON.stringify({ v: 1, juegos: { nexo: { racha: 4, record: 4, jugadas: 4, ganadas: 4 } }, sobres: 4 }))
    oyentes.get('storage')({ key: CLAVE_PROGRESO })
    expect(progresoDe(almacen.getSnapshot(), 'nexo').racha).toBe(4)
    soltar()
    expect(oyentes.size).toBe(0)

    const sinDisco = crearAlmacenProgreso({
      storage: () => {
        throw new Error('bloqueado')
      },
    })
    sinDisco.anotarRonda('nexo', { ganada: true })
    expect(progresoDe(sinDisco.getSnapshot(), 'nexo').racha).toBe(1)
  })
})
