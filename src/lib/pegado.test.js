import { afterEach, describe, expect, it, vi } from 'vitest'
import { animarPegado, crearPegado, FOTOGRAMAS_PEGADO, MAX_RETARDO_PEGADO_MS, PASO_PEGADO_MS, retardoPegado } from './pegado.js'

/** Hueco mínimo: el <li> con su carta y, si es nueva, su sello. */
function bolsillo(id, { sello = true } = {}) {
  const animar = (nombre) => vi.fn((fotogramas, opciones) => ({ nombre, fotogramas, opciones }))
  const carta = { animate: animar('carta') }
  const selloNuevo = sello ? { animate: animar('sello') } : null
  return {
    dataset: { pegar: id },
    carta,
    sello: selloNuevo,
    querySelector: (sel) => (sel === '.carta' ? carta : sel === '.carta-sello--nueva' ? selloNuevo : null),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('animarPegado', () => {
  it('escalona las cartas que llegan a la vez, con un tope', () => {
    expect(retardoPegado(0)).toBe(0)
    expect(retardoPegado(2)).toBe(2 * PASO_PEGADO_MS)
    expect(retardoPegado(50)).toBe(MAX_RETARDO_PEGADO_MS)
  })

  it('solo anima transform y opacity, y el sello llega cuando la carta ya se ha posado', () => {
    const b = bolsillo('makima')
    const [carta, sello] = animarPegado(b, 1)
    for (const f of FOTOGRAMAS_PEGADO) expect(Object.keys(f).every((k) => ['opacity', 'transform', 'offset'].includes(k))).toBe(true)
    expect(carta.opciones).toMatchObject({ delay: PASO_PEGADO_MS, fill: 'backwards' })
    expect(sello.opciones.delay).toBeGreaterThan(carta.opciones.delay + 400)
  })

  it('sin sello anima solo la carta', () => {
    expect(animarPegado(bolsillo('power', { sello: false }))).toHaveLength(1)
  })
})

describe('crearPegado', () => {
  it('pega al momento si no hay IntersectionObserver', () => {
    vi.stubGlobal('window', {})
    const alPegar = vi.fn()
    crearPegado(alPegar)(bolsillo('denji'))
    expect(alPegar).toHaveBeenCalledWith(['denji'])
  })

  it('pega y marca como vistas las que entran en pantalla, una sola vez', () => {
    let alCruzar
    const observados = new Set()
    class IO {
      constructor(fn) {
        alCruzar = fn
      }
      observe(el) {
        observados.add(el)
      }
      unobserve(el) {
        observados.delete(el)
      }
    }
    vi.stubGlobal('window', { IntersectionObserver: IO, matchMedia: () => ({ matches: false }) })
    const alPegar = vi.fn()
    const ref = crearPegado(alPegar)
    const a = bolsillo('a')
    const b = bolsillo('b')
    const limpiarA = ref(a)
    ref(b)
    expect(ref({ dataset: {} })).toBeUndefined()
    expect(observados.size).toBe(2)

    alCruzar([
      { target: a, isIntersecting: true },
      { target: b, isIntersecting: false },
    ])
    expect(alPegar).toHaveBeenCalledWith(['a'])
    expect(a.carta.animate).toHaveBeenCalledTimes(1)
    expect(observados.has(a)).toBe(false)
    expect(observados.has(b)).toBe(true)
    limpiarA()
  })
})
