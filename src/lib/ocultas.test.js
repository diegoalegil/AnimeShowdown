// Cartas ocultas (src/data/ocultas.json): siguen en los datos, pero la
// aplicación no las muestra, no las cuenta y los sobres no las sacan. La
// colección guardada las conserva por si vuelven.
import { describe, expect, it } from 'vitest'
import { CARTAS_POR_SOBRE, CLAVE_ALMACEN, PROB_ESPECIAL } from '../config.js'
import ocultas from '../data/ocultas.json'
import personajesData from '../data/personajes.json'
import especialesData from '../data/especiales.json'
import { crearHojas, idsPorHoja, progreso, recuento } from './album.js'
import { catalogo, crearCatalogo } from './catalog.js'
import { cartasDistintas, crearAlmacen, exportar, generarSobre, porPegar, previsionImportacion } from './collection.js'
import { filtrarCartas, recorrido } from './filtros.js'

const OCULTAS = new Set(ocultas.map((o) => o.id))

/** Generador determinista (mulberry32). */
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

function storageFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial))
  return { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), datos }
}

const datosMini = {
  personajes: [
    { id: 'denji', n: 1, nombre: 'Denji', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'reze', n: 2, nombre: 'Reze', anime: 'Chainsaw Man', animeId: 'csm', nativo: 'レゼ', desc: 'Del café.' },
    { id: 'power', n: 3, nombre: 'Power', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'solo', n: 4, nombre: 'Solo', anime: 'Serie Oculta', animeId: 'oculta' },
  ],
  especiales: [
    { id: 'e-reze', n: 1, personajeId: 'reze', nombre: 'Reze', anime: 'Chainsaw Man', animeId: 'csm' },
    { id: 'e-power', n: 2, personajeId: 'power', nombre: 'Power', anime: 'Chainsaw Man', animeId: 'csm' },
  ],
  animes: [
    { id: 'csm', titulo: 'Chainsaw Man', count: 3 },
    { id: 'oculta', titulo: 'Serie Oculta', count: 1 },
  ],
}
const mini = crearCatalogo({
  ...datosMini,
  ocultas: [
    { id: 'reze', motivo: 'nombre de otro personaje' },
    { id: 'e-power', motivo: 'arte de otro personaje' },
    { id: 'solo', motivo: 'arte de otro personaje' },
  ],
})
const sinOcultar = crearCatalogo(datosMini)
const ids = (cartas) => cartas.map((c) => c.id)

describe('catálogo con cartas ocultas', () => {
  it('las deja fuera de las listas, la búsqueda, las series y las vecinas', () => {
    expect(ids(mini.personajes)).toEqual(['denji', 'power'])
    expect(ids(mini.especiales)).toEqual(['e-reze'])
    expect(mini.total).toBe(3)
    expect(ids(mini.buscar(''))).toEqual(['denji', 'power', 'e-reze'])
    expect(ids(mini.buscar('reze'))).toEqual(['e-reze'])
    expect(ids(mini.cartasDeAnime('csm'))).toEqual(['denji', 'power', 'e-reze'])
    expect(mini.vecinas('denji').siguiente.id).toBe('power')
    expect(mini.vecinas('reze').siguiente).toBeUndefined()
  })

  it('no existen para la aplicación, pero se reconocen como cartas guardables', () => {
    expect(mini.carta('reze')).toBeUndefined()
    expect(mini.existe('reze')).toBe(false)
    expect(mini.oculta('reze')).toBe(true)
    expect(mini.conocida('reze')).toBe(true)
    expect(mini.oculta('denji')).toBe(false)
    expect(mini.oculta('nadie')).toBe(false)
    expect(mini.conocida('nadie')).toBe(false)
  })

  it('cuenta en cada serie solo las cartas visibles y omite las series vacías', () => {
    expect(mini.anime('csm').count).toBe(2)
    expect(mini.anime('oculta').count).toBe(0)
    expect(ids(mini.animes)).toEqual(['csm'])
    expect(ids(sinOcultar.animes)).toEqual(['csm', 'oculta'])
  })

  it('una especial cuyo personaje está oculto va sola, sin versión normal', () => {
    expect(ids(mini.familia('e-reze'))).toEqual(['e-reze'])
    expect(mini.familia('reze')).toEqual([])
    expect(ids(sinOcultar.familia('e-reze'))).toEqual(['reze', 'e-reze'])
    // Conserva el nombre original y la descripción de su carta normal.
    expect(mini.carta('e-reze')).toMatchObject({ nativo: 'レゼ', desc: 'Del café.', personajeId: 'reze' })
    expect(datosMini.especiales[0].nativo).toBeUndefined()
  })

  it('volver a mostrarla es quitarla de la lista', () => {
    expect(sinOcultar.carta('reze')?.nombre).toBe('Reze')
    expect(sinOcultar.anime('csm').count).toBe(3)
  })
})

describe('catálogo real', () => {
  it('ninguna carta de ocultas.json se ve en la galería', () => {
    expect(OCULTAS.size).toBe(ocultas.length)
    for (const id of OCULTAS) {
      expect(catalogo.existe(id)).toBe(false)
      expect(catalogo.conocida(id)).toBe(true)
    }
    const galeria = [...filtrarCartas({ q: '', serie: '' }), ...filtrarCartas({ q: '', serie: 'especiales' })]
    expect(galeria.some((c) => OCULTAS.has(c.id))).toBe(false)
    const ocultosP = personajesData.filter((c) => OCULTAS.has(c.id)).length
    const ocultosE = especialesData.filter((c) => OCULTAS.has(c.id)).length
    expect(catalogo.personajes).toHaveLength(personajesData.length - ocultosP)
    expect(catalogo.especiales).toHaveLength(especialesData.length - ocultosE)
    expect(catalogo.total).toBe(catalogo.personajes.length + catalogo.especiales.length)
  })

  it('la serie de Kurome no la muestra ni la cuenta', () => {
    const akame = catalogo.cartasDeAnime('akame-ga-kill')
    expect(ids(akame)).not.toContain('kurome')
    expect(catalogo.anime('akame-ga-kill').count).toBe(akame.filter((c) => !c.id.startsWith('e-')).length)
  })

  it('la ficha de e-reze no ofrece una versión normal y recorre sin cartas ocultas', () => {
    expect(ids(catalogo.familia('e-reze'))).toEqual(['e-reze'])
    expect(catalogo.carta('e-reze').nativo).toBe('レゼ')
    const { anterior, siguiente } = recorrido({ q: '', serie: '' }, catalogo.carta('e-reze'))
    expect(OCULTAS.has(anterior?.id)).toBe(false)
    expect(OCULTAS.has(siguiente?.id)).toBe(false)
    for (const c of catalogo.personajes) {
      const vecinas = recorrido({ q: '', serie: c.animeId }, c)
      expect(OCULTAS.has(vecinas.anterior?.id) || OCULTAS.has(vecinas.siguiente?.id)).toBe(false)
    }
  })
})

describe('sobres', () => {
  const visibles = {
    personajes: ids(catalogo.personajes),
    especiales: ids(catalogo.especiales),
  }

  it('nunca sacan una carta oculta y mantienen el 15 % de especiales entre las visibles', () => {
    const rng = semilla(2026)
    const tiradas = 20000
    let especiales = 0
    const vistas = new Set()
    for (let i = 0; i < tiradas; i++) {
      const sobre = generarSobre({ ...visibles, rng })
      expect(sobre).toHaveLength(CARTAS_POR_SOBRE)
      for (const id of sobre) {
        expect(OCULTAS.has(id)).toBe(false)
        vistas.add(id)
      }
      if (sobre[CARTAS_POR_SOBRE - 1].startsWith('e-')) especiales++
    }
    expect(especiales / tiradas).toBeGreaterThan(PROB_ESPECIAL - 0.015)
    expect(especiales / tiradas).toBeLessThan(PROB_ESPECIAL + 0.015)
    // Salen todas las especiales visibles, también e-reze.
    for (const id of visibles.especiales) expect(vistas.has(id)).toBe(true)
  })

  it('el almacén de la aplicación solo reparte cartas visibles', () => {
    const almacen = crearAlmacen({ storage: () => storageFalso(), ids: visibles, existe: catalogo.conocida })
    for (let i = 0; i < 5; i++) {
      for (const id of almacen.abrirSobre(semilla(i)).ids) expect(catalogo.existe(id)).toBe(true)
    }
  })
})

describe('álbum', () => {
  const hojas = crearHojas()

  it('los totales cuentan solo las cartas visibles', () => {
    const { personajes, especiales } = progreso(hojas, {})
    expect(personajes.total).toBe(catalogo.personajes.length)
    expect(especiales.total).toBe(catalogo.especiales.length)
    expect(recuento({}).personajes.total).toBe(catalogo.personajes.length)
    for (const hoja of hojas) expect(hoja.cartas.some((c) => OCULTAS.has(c.id))).toBe(false)
  })

  it('una serie se completa con sus cartas visibles; las ocultas que se tengan no suman', () => {
    const akame = hojas.find((h) => h.id === 'akame-ga-kill')
    const tengo = Object.fromEntries([...akame.cartas.map((c) => [c.id, 1]), ['kurome', 3], ['e-all_for_one', 1]])
    const cuenta = progreso(hojas, tengo)
    expect(cuenta.porHoja.get('akame-ga-kill')).toBe(akame.cartas.length)
    expect(cuenta.personajes.tengo).toBe(akame.cartas.length)
    expect(cuenta.especiales.tengo).toBe(0)
    expect(recuento(tengo).personajes.tengo).toBe(akame.cartas.length)
    expect(recuento(tengo).especiales.tengo).toBe(0)
    expect([...idsPorHoja(['kurome', 'e-all_for_one']).keys()]).toEqual([])
  })
})

describe('colección guardada con cartas ocultas', () => {
  const DIA = new Date(2026, 8, 25, 12)
  const crear = (cat, storage) =>
    crearAlmacen({
      storage: () => storage,
      ids: { personajes: ids(cat.personajes), especiales: ids(cat.especiales) },
      existe: cat.conocida,
      ahora: () => DIA,
    })
  const guardado = (tengo) =>
    JSON.stringify({ v: 1, tengo, desde: {}, dia: '2026-09-25', abiertos: 0, ultimo: Object.keys(tengo), pegadas: [] })

  it('las conserva en el almacenamiento, pero no las cuenta ni las pega', () => {
    const storage = storageFalso({ [CLAVE_ALMACEN]: guardado({ denji: 1, reze: 2, 'e-power': 1 }) })
    const almacen = crear(mini, storage)
    const estado = almacen.getSnapshot()
    expect(estado.tengo).toEqual({ denji: 1, reze: 2, 'e-power': 1 })
    expect(cartasDistintas(estado, mini.existe)).toBe(1)
    expect(recuento(estado.tengo, mini).personajes.tengo).toBe(1)
    expect(recuento(estado.tengo, mini).especiales.tengo).toBe(0)
    expect(porPegar(estado, mini.existe)).toEqual(['denji'])
    expect(estado.ultimo.filter(mini.existe)).toEqual(['denji'])

    // Abrir un sobre las mantiene en el disco.
    almacen.abrirSobre(semilla(1))
    expect(JSON.parse(storage.datos.get(CLAVE_ALMACEN)).tengo).toMatchObject({ reze: 2, 'e-power': 1 })
  })

  it('el código de la colección las lleva y se importa sin errores', () => {
    const codigo = exportar({ tengo: { denji: 1, reze: 2 }, desde: { denji: '2026-09-01', reze: '2026-09-02' } })

    const vacio = crear(mini, storageFalso())
    const leido = vacio.comprobar(codigo)
    expect(leido).toMatchObject({ ok: true, descartadas: 0 })
    expect(previsionImportacion(vacio.getSnapshot(), leido, mini.existe)).toMatchObject({ entrantes: 1, nuevas: 1 })

    expect(vacio.importar(codigo, 'sustituir').ok).toBe(true)
    expect(vacio.getSnapshot().tengo).toEqual({ denji: 1, reze: 2 })

    const otro = crear(mini, storageFalso({ [CLAVE_ALMACEN]: guardado({ power: 1 }) }))
    expect(otro.importar(codigo, 'combinar').ok).toBe(true)
    expect(otro.getSnapshot().tengo).toEqual({ power: 1, denji: 1, reze: 2 })
    expect(cartasDistintas(otro.getSnapshot(), mini.existe)).toBe(2)
  })

  it('un código con solo cartas ocultas también se acepta y se conserva', () => {
    const almacen = crear(mini, storageFalso())
    expect(almacen.importar(exportar({ tengo: { reze: 1 }, desde: {} })).ok).toBe(true)
    expect(almacen.getSnapshot().tengo).toEqual({ reze: 1 })
  })

  it('al volver a mostrar la carta, reaparece con sus copias', () => {
    const storage = storageFalso({ [CLAVE_ALMACEN]: guardado({ denji: 1, reze: 2 }) })
    const oculta = crear(mini, storage)
    oculta.pegar(['denji']) // se guarda estando oculta
    expect(recuento(oculta.getSnapshot().tengo, mini).personajes.tengo).toBe(1)

    const visible = crear(sinOcultar, storage).getSnapshot()
    expect(visible.tengo.reze).toBe(2)
    expect(recuento(visible.tengo, sinOcultar).personajes.tengo).toBe(2)
    // Aún no se ha visto en su hueco: se pega con su animación en la próxima visita.
    expect(porPegar(visible, sinOcultar.existe)).toEqual(['reze'])
  })
})
