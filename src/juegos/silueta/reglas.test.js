import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { PERSONAJES } from '../comun/cartas.js'
import { catalogo } from '../../lib/catalog.js'
import disponibles from './disponibles.json'
import {
  CANDIDATOS,
  MAX_INTENTOS,
  ORDEN_APERTURA,
  intentar,
  intentosUsados,
  mismaSerie,
  muestraMismaSerie,
  nuevaRonda,
  panelesAbiertos,
  pistaDisponible,
  puntosDe,
  restantes,
  tituloDe,
  usarPista,
  yaIntentado,
} from './reglas.js'

const otro = (estado, { serie } = {}) =>
  PERSONAJES.find((c) => c.id !== estado.objetivo.id && !yaIntentado(estado, c) && (serie ? c.animeId === estado.objetivo.animeId : c.animeId !== estado.objetivo.animeId))

describe('candidatos', () => {
  it('la lista de siluetas está ordenada, sin repetidos y solo con personajes visibles', () => {
    expect(disponibles).toEqual([...new Set(disponibles)].sort())
    expect(disponibles.length).toBeGreaterThan(500)
    for (const id of disponibles) expect(catalogo.existe(id), id).toBe(true)
    expect(CANDIDATOS).toHaveLength(disponibles.length)
    expect(CANDIDATOS.every((c) => !c.id.startsWith('e-'))).toBe(true)
  })
})

describe('nuevaRonda', () => {
  it('es determinista con semilla y elige entre los candidatos', () => {
    const a = nuevaRonda(crearAzar(3))
    const b = nuevaRonda(crearAzar(3))
    expect(a.objetivo).toBe(b.objetivo)
    expect(CANDIDATOS).toContain(a.objetivo)
    expect(a).toMatchObject({ intentos: [], pista: false, fin: null })
  })

  it('respeta los excluidos y, si los agota, vuelve a usar todos', () => {
    const excluir = new Set(CANDIDATOS.slice(1).map((c) => c.id))
    for (let i = 0; i < 20; i++) expect(nuevaRonda(crearAzar(i), { excluir }).objetivo).toBe(CANDIDATOS[0])
    const todos = new Set(CANDIDATOS.map((c) => c.id))
    expect(CANDIDATOS).toContain(nuevaRonda(crearAzar(1), { excluir: todos }).objetivo)
  })
})

describe('intentar', () => {
  it('acertar gana la ronda y abre los cuatro paneles', () => {
    const ronda = nuevaRonda(crearAzar(5))
    const fin = intentar(ronda, ronda.objetivo)
    expect(fin.fin).toBe('victoria')
    expect(panelesAbiertos(fin)).toEqual(ORDEN_APERTURA)
    expect(puntosDe(fin)).toBe(MAX_INTENTOS)
    expect(tituloDe(fin)).toBe('Precisión legendaria')
  })

  it('cada fallo abre un panel en el orden centro-izquierda, centro-derecha, izquierda, derecha', () => {
    let estado = nuevaRonda(crearAzar(8))
    const abiertos = []
    for (let i = 0; i < 4; i++) {
      estado = intentar(estado, otro(estado))
      abiertos.push(panelesAbiertos(estado))
    }
    expect(abiertos).toEqual([[1], [1, 2], [1, 2, 0], [1, 2, 0, 3]])
    expect(estado.fin).toBeNull()
    expect(restantes(estado)).toBe(1)
  })

  it('el quinto fallo pierde la ronda y cierra el biombo', () => {
    let estado = nuevaRonda(crearAzar(9))
    for (let i = 0; i < 5; i++) estado = intentar(estado, otro(estado))
    expect(estado.fin).toBe('derrota')
    expect(panelesAbiertos(estado)).toEqual([])
    expect(puntosDe(estado)).toBe(0)
    expect(intentar(estado, estado.objetivo)).toBe(estado)
  })

  it('acertar con el último intento vale un punto', () => {
    let estado = nuevaRonda(crearAzar(10))
    for (let i = 0; i < 4; i++) estado = intentar(estado, otro(estado))
    estado = intentar(estado, estado.objetivo)
    expect(estado.fin).toBe('victoria')
    expect(puntosDe(estado)).toBe(1)
    expect(tituloDe(estado)).toBe('Justo a tiempo')
  })

  it('repetir un personaje no gasta intento', () => {
    const ronda = nuevaRonda(crearAzar(11))
    const fallo = otro(ronda)
    const estado = intentar(ronda, fallo)
    expect(yaIntentado(estado, fallo)).toBe(true)
    expect(intentar(estado, fallo)).toBe(estado)
  })

  it('no muta el estado anterior', () => {
    const ronda = nuevaRonda(crearAzar(12))
    intentar(ronda, otro(ronda))
    expect(ronda.intentos).toEqual([])
  })
})

describe('pista', () => {
  it('cuesta un intento, abre un panel y solo se puede usar una vez', () => {
    const ronda = nuevaRonda(crearAzar(13))
    expect(pistaDisponible(ronda)).toBe(true)
    const conPista = usarPista(ronda)
    expect(intentosUsados(conPista)).toBe(1)
    expect(conPista.pistaEn).toBe(0)
    expect(usarPista(intentar(ronda, otro(ronda))).pistaEn).toBe(1)
    expect(panelesAbiertos(conPista)).toEqual([1])
    expect(pistaDisponible(conPista)).toBe(false)
    expect(usarPista(conPista)).toBe(conPista)
  })

  it('no se puede pedir como último intento ni con la ronda terminada', () => {
    let estado = nuevaRonda(crearAzar(14))
    for (let i = 0; i < 4; i++) estado = intentar(estado, otro(estado))
    expect(pistaDisponible(estado)).toBe(false)
    expect(usarPista(estado)).toBe(estado)
    const ganada = intentar(nuevaRonda(crearAzar(14)), nuevaRonda(crearAzar(14)).objetivo)
    expect(usarPista(ganada)).toBe(ganada)
  })

  it('con pista, el cuarto fallo pierde (cinco intentos en total)', () => {
    let estado = usarPista(nuevaRonda(crearAzar(15)))
    for (let i = 0; i < 3; i++) estado = intentar(estado, otro(estado))
    expect(estado.fin).toBeNull()
    expect(restantes(estado)).toBe(1)
    estado = intentar(estado, otro(estado))
    expect(estado.fin).toBe('derrota')
  })

  it('acertar al segundo intento con pista tiene su propio título', () => {
    const ronda = usarPista(nuevaRonda(crearAzar(16)))
    expect(tituloDe(intentar(ronda, ronda.objetivo))).toBe('Precisión con pista')
    expect(puntosDe(intentar(ronda, ronda.objetivo))).toBe(4)
  })
})

describe('misma serie', () => {
  it('se enseña a partir del segundo intento, y marca solo los fallos de la misma serie', () => {
    const ronda = nuevaRonda(crearAzar(17))
    const compañero = otro(ronda, { serie: true })
    if (!compañero) return // serie de un solo personaje: no hay nada que marcar
    const uno = intentar(ronda, compañero)
    expect(muestraMismaSerie(uno)).toBe(false)
    const dos = intentar(uno, otro(uno))
    expect(muestraMismaSerie(dos)).toBe(true)
    expect(mismaSerie(dos, compañero)).toBe(true)
    expect(mismaSerie(dos, dos.intentos[1])).toBe(false)
    expect(mismaSerie(dos, dos.objetivo)).toBe(false)
  })
})
