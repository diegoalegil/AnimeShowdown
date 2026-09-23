import { describe, expect, it, vi } from 'vitest'
import { CARTAS_POR_SOBRE, CLAVE_ALMACEN, PROB_ESPECIAL, SOBRES_POR_DIA } from '../config.js'
import {
  abrirSobre,
  almacenSeguro,
  cartasDistintas,
  copiasTotales,
  crearAlmacen,
  diaLocal,
  esNueva,
  estadoVacio,
  exportar,
  generarSobre,
  leerCodigo,
  msHastaMedianoche,
  sanear,
  sobresRestantes,
} from './collection.js'

const PERSONAJES = ['a', 'b', 'c', 'd', 'e', 'f']
const ESPECIALES = ['e-a', 'e-b']
const existe = (id) => PERSONAJES.includes(id) || ESPECIALES.includes(id)

/** RNG que devuelve la secuencia dada (y repite el último valor). */
const secuencia = (...valores) => {
  let i = 0
  return () => valores[Math.min(i++, valores.length - 1)]
}

/** Storage en memoria con la interfaz de localStorage. */
function storageFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    datos,
  }
}

describe('diaLocal', () => {
  it('usa la fecha local, no UTC', () => {
    expect(diaLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(diaLocal(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })

  it('calcula el tiempo hasta la medianoche local', () => {
    expect(msHastaMedianoche(new Date(2026, 4, 1, 23, 0))).toBe(60 * 60 * 1000)
  })
})

describe('generarSobre', () => {
  it(`trae ${CARTAS_POR_SOBRE} cartas y las cuatro primeras son personajes`, () => {
    const sobre = generarSobre({ personajes: PERSONAJES, especiales: ESPECIALES, rng: secuencia(0, 0.2, 0.5, 0.99, 0) })
    expect(sobre).toHaveLength(CARTAS_POR_SOBRE)
    expect(sobre.slice(0, 4)).toEqual(['a', 'b', 'd', 'f'])
  })

  it(`la quinta es especial si el azar cae por debajo de ${PROB_ESPECIAL}`, () => {
    const conEspecial = generarSobre({
      personajes: PERSONAJES,
      especiales: ESPECIALES,
      rng: secuencia(0, 0, 0, 0, PROB_ESPECIAL - 0.01, 0.7),
    })
    expect(conEspecial[4]).toBe('e-b')

    const sinEspecial = generarSobre({
      personajes: PERSONAJES,
      especiales: ESPECIALES,
      rng: secuencia(0, 0, 0, 0, PROB_ESPECIAL, 0.5),
    })
    expect(sinEspecial[4]).toBe('d')
  })

  it('nunca se sale de la lista aunque el RNG devuelva 1', () => {
    const sobre = generarSobre({ personajes: PERSONAJES, especiales: ESPECIALES, rng: () => 1 })
    expect(sobre.every((id) => PERSONAJES.includes(id))).toBe(true)
  })

  it('reparte las especiales cerca del 15 % en muchas tiradas', () => {
    let semilla = 42
    const rng = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    let especiales = 0
    const tiradas = 20000
    for (let i = 0; i < tiradas; i++) {
      if (generarSobre({ personajes: PERSONAJES, especiales: ESPECIALES, rng })[4].startsWith('e-')) especiales++
    }
    expect(especiales / tiradas).toBeGreaterThan(PROB_ESPECIAL - 0.015)
    expect(especiales / tiradas).toBeLessThan(PROB_ESPECIAL + 0.015)
  })
})

describe('abrirSobre', () => {
  it('suma copias, cuenta repetidas y marca las nuevas con la fecha', () => {
    const inicio = { ...estadoVacio('2026-03-01'), tengo: { a: 1 }, desde: { a: '2026-02-01' } }
    const { estado, nuevas } = abrirSobre(inicio, ['a', 'b', 'b', 'c', 'e-a'], '2026-03-01')
    expect(estado.tengo).toEqual({ a: 2, b: 2, c: 1, 'e-a': 1 })
    expect(nuevas).toEqual(['b', 'c', 'e-a'])
    expect(estado.desde.a).toBe('2026-02-01')
    expect(estado.desde.b).toBe('2026-03-01')
    expect(estado.abiertos).toBe(1)
    expect(estado.ultimo).toEqual(['a', 'b', 'b', 'c', 'e-a'])
    expect(cartasDistintas(estado)).toBe(4)
    expect(copiasTotales(estado)).toBe(6)
    expect(esNueva(estado, 'b', '2026-03-01')).toBe(true)
    expect(esNueva(estado, 'a', '2026-03-01')).toBe(false)
    expect(inicio.tengo).toEqual({ a: 1 })
  })

  it(`permite ${SOBRES_POR_DIA} sobres al día y se reinicia al cambiar de día`, () => {
    let estado = estadoVacio('2026-03-01')
    for (let i = 0; i < SOBRES_POR_DIA; i++) estado = abrirSobre(estado, ['a'], '2026-03-01').estado
    expect(sobresRestantes(estado, '2026-03-01')).toBe(0)
    expect(() => abrirSobre(estado, ['a'], '2026-03-01')).toThrow()
    expect(sobresRestantes(estado, '2026-03-02')).toBe(SOBRES_POR_DIA)
    const siguiente = abrirSobre(estado, ['b'], '2026-03-02').estado
    expect(siguiente.dia).toBe('2026-03-02')
    expect(siguiente.abiertos).toBe(1)
  })
})

describe('sanear', () => {
  const dia = '2026-03-01'

  it('devuelve un estado vacío ante datos rotos o de otra versión', () => {
    for (const bruto of [null, 'x', 3, [], { v: 2, tengo: { a: 1 } }]) {
      expect(sanear(bruto, { dia, existe })).toEqual(estadoVacio(dia))
    }
  })

  it('descarta cartas desconocidas, cantidades inválidas y fechas mal formadas', () => {
    const estado = sanear(
      {
        v: 1,
        tengo: { a: 2, zzz: 1, b: 0, c: 1.5, d: '3', e: 1, __proto__: 1 },
        desde: { a: '2026-01-01', e: 'ayer' },
        dia,
        abiertos: 2,
        ultimo: ['a', 'zzz', 5],
      },
      { dia, existe },
    )
    expect(estado.tengo).toEqual({ a: 2, e: 1 })
    expect(estado.desde).toEqual({ a: '2026-01-01', e: dia })
    expect(estado.abiertos).toBe(2)
    expect(estado.ultimo).toEqual(['a'])
  })

  it('pone a cero los sobres si el día guardado es otro y acota el contador', () => {
    expect(sanear({ v: 1, tengo: {}, dia: '2026-02-28', abiertos: 5 }, { dia }).abiertos).toBe(0)
    expect(sanear({ v: 1, tengo: {}, dia, abiertos: 99 }, { dia }).abiertos).toBe(SOBRES_POR_DIA)
    expect(sanear({ v: 1, tengo: {}, dia, abiertos: -3 }, { dia }).abiertos).toBe(0)
  })
})

describe('exportar y leerCodigo', () => {
  const dia = '2026-03-01'

  it('ida y vuelta conserva las cartas y las fechas', () => {
    const estado = { ...estadoVacio(dia), tengo: { a: 3, 'e-b': 1 }, desde: { a: '2026-01-02', 'e-b': dia }, abiertos: 4 }
    const codigo = exportar(estado)
    expect(codigo).toMatch(/^[A-Za-z0-9+/=]+$/)
    const leido = leerCodigo(`  ${codigo.slice(0, 10)}\n${codigo.slice(10)} `, { existe, dia })
    expect(leido).toEqual({ ok: true, tengo: estado.tengo, desde: estado.desde, descartadas: 0 })
  })

  it('rechaza códigos vacíos, corruptos o ajenos', () => {
    expect(leerCodigo('', { existe, dia }).ok).toBe(false)
    expect(leerCodigo('%%%', { existe, dia }).ok).toBe(false)
    expect(leerCodigo(btoa('{"hola":1}'), { existe, dia }).ok).toBe(false)
    expect(leerCodigo(btoa('{"v":1,"tengo":{"zzz":1}}'), { existe, dia }).ok).toBe(false)
  })

  it('ignora las cartas que ya no existen y lo indica', () => {
    const leido = leerCodigo(btoa('{"v":1,"tengo":{"a":1,"zzz":2}}'), { existe, dia })
    expect(leido).toMatchObject({ ok: true, tengo: { a: 1 }, desde: { a: dia }, descartadas: 1 })
  })
})

describe('almacenSeguro', () => {
  it('sigue funcionando en memoria si localStorage lanza', () => {
    const roto = {
      getItem() {
        throw new Error('SecurityError')
      },
      setItem() {
        throw new Error('QuotaExceededError')
      },
    }
    const almacen = almacenSeguro(() => roto)
    almacen.escribir('k', 'v')
    expect(almacen.leer('k')).toBe('v')

    const sinAcceso = almacenSeguro(() => {
      throw new Error('bloqueado')
    })
    sinAcceso.escribir('k', 'w')
    expect(sinAcceso.leer('k')).toBe('w')
  })
})

describe('crearAlmacen', () => {
  const crear = (storage, fecha = new Date(2026, 2, 1, 12)) => {
    const reloj = { fecha }
    const almacen = crearAlmacen({
      storage: () => storage,
      ids: { personajes: PERSONAJES, especiales: ESPECIALES },
      existe,
      ahora: () => reloj.fecha,
    })
    return { almacen, reloj }
  }

  it('abre sobres, guarda en localStorage y avisa a los suscriptores', () => {
    const storage = storageFalso()
    const { almacen } = crear(storage)
    const oyente = vi.fn()
    almacen.subscribe(oyente)
    const primero = almacen.getSnapshot()
    expect(almacen.getSnapshot()).toBe(primero)

    const { ids, nuevas } = almacen.abrirSobre(secuencia(0, 0.2, 0.4, 0.6, 0.9, 0.9))
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'f'])
    expect(nuevas).toEqual(ids)
    expect(oyente).toHaveBeenCalledTimes(1)
    expect(almacen.getSnapshot()).not.toBe(primero)

    const guardado = JSON.parse(storage.datos.get(CLAVE_ALMACEN))
    expect(guardado).toMatchObject({ v: 1, dia: '2026-03-01', abiertos: 1, tengo: { a: 1, f: 1 } })
  })

  it(`no deja abrir más de ${SOBRES_POR_DIA} sobres hasta el día siguiente`, () => {
    const { almacen, reloj } = crear(storageFalso())
    for (let i = 0; i < SOBRES_POR_DIA; i++) almacen.abrirSobre(() => 0)
    expect(() => almacen.abrirSobre(() => 0)).toThrow()
    reloj.fecha = new Date(2026, 2, 2, 0, 0, 1)
    expect(() => almacen.abrirSobre(() => 0)).not.toThrow()
    expect(almacen.getSnapshot()).toMatchObject({ dia: '2026-03-02', abiertos: 1, tengo: { a: (SOBRES_POR_DIA + 1) * (CARTAS_POR_SOBRE - 1), 'e-a': SOBRES_POR_DIA + 1 } })
  })

  it('recupera lo guardado y lo sanea al leer', () => {
    const storage = storageFalso({
      [CLAVE_ALMACEN]: JSON.stringify({ v: 1, tengo: { a: 2, zzz: 1 }, desde: { a: '2026-01-01' }, dia: '2026-03-01', abiertos: 3 }),
    })
    const { almacen } = crear(storage)
    expect(almacen.getSnapshot()).toMatchObject({ tengo: { a: 2 }, abiertos: 3 })
  })

  it('arranca vacío si lo guardado no es JSON', () => {
    const { almacen } = crear(storageFalso({ [CLAVE_ALMACEN]: '{roto' }))
    expect(almacen.getSnapshot()).toEqual(estadoVacio('2026-03-01'))
  })

  it('importa un código sin regalar sobres', () => {
    const { almacen } = crear(storageFalso())
    almacen.abrirSobre(() => 0)
    const codigo = exportar({ tengo: { b: 4 }, desde: { b: '2026-01-01' } })
    expect(almacen.importar(codigo).ok).toBe(true)
    expect(almacen.getSnapshot()).toMatchObject({ tengo: { b: 4 }, abiertos: 1 })
    expect(almacen.importar('basura').ok).toBe(false)
    expect(almacen.exportar()).toBe(codigo)
  })
})

// ---------------------------------------------------------------------------
// Reglas del sobre diario, de punta a punta con el almacén.
// ---------------------------------------------------------------------------

/** Generador determinista (mulberry32) para las pruebas estadísticas. */
function semilla(n) {
  let a = n >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ventana mínima: lo que el almacén usa para otras pestañas y la visibilidad. */
function ventanaFalsa() {
  const oyentes = new Map()
  const on = (tipo, fn) => oyentes.set(tipo, fn)
  return {
    addEventListener: on,
    removeEventListener: (tipo) => oyentes.delete(tipo),
    document: { visibilityState: 'visible', addEventListener: on, removeEventListener: (tipo) => oyentes.delete(tipo) },
    oyentes,
  }
}

describe('sobre diario', () => {
  const crear = ({ storage = storageFalso(), fecha = new Date(2026, 2, 1, 21, 30), ventana, ids } = {}) => {
    const reloj = { fecha }
    const almacen = crearAlmacen({
      storage: () => storage,
      ids: ids ?? { personajes: PERSONAJES, especiales: ESPECIALES },
      existe: ids ? () => true : existe,
      ahora: () => reloj.fecha,
      ventana,
    })
    return { almacen, reloj, storage }
  }

  it(`el sexto sobre del día se rechaza sin tocar la colección`, () => {
    const { almacen } = crear()
    for (let i = 0; i < SOBRES_POR_DIA; i++) almacen.abrirSobre(semilla(i))
    const antes = almacen.getSnapshot()
    expect(sobresRestantes(antes, almacen.hoy())).toBe(0)
    expect(() => almacen.abrirSobre(semilla(99))).toThrow('Hoy ya no quedan sobres')
    expect(almacen.getSnapshot()).toBe(antes)
    expect(copiasTotales(antes)).toBe(SOBRES_POR_DIA * CARTAS_POR_SOBRE)
  })

  it('a medianoche local vuelven los cinco sobres y la colección se conserva', () => {
    vi.useFakeTimers()
    try {
      const ventana = ventanaFalsa()
      const { almacen, reloj } = crear({ ventana })
      const oyente = vi.fn()
      const soltar = almacen.subscribe(oyente)
      for (let i = 0; i < SOBRES_POR_DIA; i++) almacen.abrirSobre(semilla(i))
      const cartas = almacen.getSnapshot().tengo
      expect(sobresRestantes(almacen.getSnapshot(), almacen.hoy())).toBe(0)
      oyente.mockClear()

      // 23:59:59: todavía es el mismo día.
      reloj.fecha = new Date(2026, 2, 1, 23, 59, 59)
      vi.advanceTimersByTime(msHastaMedianoche(new Date(2026, 2, 1, 21, 30)) - 2000)
      expect(oyente).not.toHaveBeenCalled()

      // Pasada la medianoche salta el temporizador sin que nadie abra nada.
      reloj.fecha = new Date(2026, 2, 2, 0, 0, 1)
      vi.advanceTimersByTime(3000)
      expect(oyente).toHaveBeenCalledTimes(1)
      const nuevo = almacen.getSnapshot()
      expect(nuevo).toMatchObject({ dia: '2026-03-02', abiertos: 0 })
      expect(nuevo.tengo).toEqual(cartas)
      expect(sobresRestantes(nuevo, almacen.hoy())).toBe(SOBRES_POR_DIA)
      soltar()
      expect(ventana.oyentes.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('al volver a la pestaña tras la medianoche también se reinicia', () => {
    const ventana = ventanaFalsa()
    const { almacen, reloj } = crear({ ventana })
    almacen.subscribe(() => {})
    almacen.abrirSobre(semilla(1))
    reloj.fecha = new Date(2026, 2, 3, 9, 0)
    ventana.oyentes.get('visibilitychange')()
    expect(almacen.getSnapshot()).toMatchObject({ dia: '2026-03-03', abiertos: 0 })
  })

  it('la quinta carta es especial el 15 % de las veces, repartida por igual entre las especiales', () => {
    const personajes = Array.from({ length: 120 }, (_, i) => `p${i}`)
    const especiales = Array.from({ length: 52 }, (_, i) => `e-${i}`)
    const rng = semilla(20260923)
    const tiradas = 40000
    const porEspecial = new Map(especiales.map((id) => [id, 0]))
    let conEspecial = 0
    for (let i = 0; i < tiradas; i++) {
      const sobre = generarSobre({ personajes, especiales, rng })
      // Las cuatro primeras nunca son especiales.
      expect(sobre.slice(0, 4).some((id) => id.startsWith('e-'))).toBe(false)
      if (sobre[4].startsWith('e-')) {
        conEspecial++
        porEspecial.set(sobre[4], porEspecial.get(sobre[4]) + 1)
      }
    }
    // Proporción: dentro de 4 desviaciones típicas de una binomial.
    const sd = Math.sqrt((PROB_ESPECIAL * (1 - PROB_ESPECIAL)) / tiradas)
    expect(Math.abs(conEspecial / tiradas - PROB_ESPECIAL)).toBeLessThan(4 * sd)
    // Uniformidad: χ² con 51 grados de libertad por debajo del valor crítico al 0,1 % (≈ 87,97).
    const esperado = conEspecial / especiales.length
    const chi2 = [...porEspecial.values()].reduce((s, n) => s + (n - esperado) ** 2 / esperado, 0)
    expect(chi2).toBeLessThan(87.97)
    expect(Math.min(...porEspecial.values())).toBeGreaterThan(0)
  })

  it('las repetidas cuentan copias y solo la primera es nueva', () => {
    const { almacen } = crear()
    // a, a, b, a y la quinta sin especial: c.
    const primero = almacen.abrirSobre(secuencia(0, 0, 0.2, 0, 0.9, 0.4))
    expect(primero.ids).toEqual(['a', 'a', 'b', 'a', 'c'])
    expect(primero.nuevas).toEqual(['a', 'b', 'c'])
    expect(almacen.getSnapshot().tengo).toEqual({ a: 3, b: 1, c: 1 })

    const segundo = almacen.abrirSobre(secuencia(0, 0.2, 0.2, 0.99, 0.9, 0.99))
    expect(segundo.ids).toEqual(['a', 'b', 'b', 'f', 'f'])
    expect(segundo.nuevas).toEqual(['f'])
    expect(almacen.getSnapshot().tengo).toEqual({ a: 4, b: 3, c: 1, f: 2 })
    expect(cartasDistintas(almacen.getSnapshot())).toBe(4)
  })

  it('las cartas quedan guardadas en el momento de abrir (recargar no las pierde)', () => {
    const storage = storageFalso()
    const { almacen } = crear({ storage })
    const { ids } = almacen.abrirSobre(semilla(7))
    const recargado = crear({ storage }).almacen.getSnapshot()
    expect(recargado.ultimo).toEqual(ids)
    expect(recargado.abiertos).toBe(1)
    for (const id of ids) expect(recargado.tengo[id]).toBeGreaterThanOrEqual(1)
  })

  it('sin localStorage (bloqueado o lleno) se juega en memoria y el límite se mantiene', () => {
    const bloqueado = {
      getItem() {
        throw new Error('SecurityError')
      },
      setItem() {
        throw new Error('QuotaExceededError')
      },
    }
    for (const storage of [bloqueado, null]) {
      const almacen = crearAlmacen({
        storage: () => {
          if (!storage) throw new Error('localStorage no disponible')
          return storage
        },
        ids: { personajes: PERSONAJES, especiales: ESPECIALES },
        existe,
        ahora: () => new Date(2026, 2, 1, 12),
      })
      expect(almacen.getSnapshot()).toEqual(estadoVacio('2026-03-01'))
      for (let i = 0; i < SOBRES_POR_DIA; i++) almacen.abrirSobre(semilla(i))
      expect(copiasTotales(almacen.getSnapshot())).toBe(SOBRES_POR_DIA * CARTAS_POR_SOBRE)
      expect(() => almacen.abrirSobre(semilla(9))).toThrow()
      expect(leerCodigo(almacen.exportar(), { existe, dia: '2026-03-01' }).ok).toBe(true)
    }
  })
})
