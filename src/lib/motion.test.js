import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activarInclinacion,
  calcularInclinacion,
  conTransicion,
  INCLINACION_MAX,
  movimientoReducido,
  nombrarCompartido,
  revelar,
  transicionActiva,
} from './motion.js'

function ventanaFalsa({ reducido = false, hover = true } = {}) {
  const listeners = {}
  return {
    matchMedia: (q) => ({ matches: q.includes('reduce') ? reducido : hover }),
    addEventListener: (tipo, fn) => (listeners[tipo] = fn),
    removeEventListener: (tipo) => delete listeners[tipo],
    listeners,
  }
}

const estiloFalso = () => {
  const props = {}
  return {
    props,
    setProperty: (k, v) => (props[k] = v),
    removeProperty: (k) => delete props[k],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preferencias de movimiento', () => {
  it('lee prefers-reduced-motion y no falla sin ventana', () => {
    expect(movimientoReducido()).toBe(false)
    vi.stubGlobal('window', ventanaFalsa({ reducido: true }))
    expect(movimientoReducido()).toBe(true)
  })

  it('usa View Transitions solo si existen y no se pide reducir', async () => {
    const actualizar = vi.fn()
    await conTransicion(actualizar)
    expect(actualizar).toHaveBeenCalledTimes(1)

    const startViewTransition = vi.fn((fn) => {
      fn()
      return { finished: Promise.resolve() }
    })
    vi.stubGlobal('document', { startViewTransition })
    vi.stubGlobal('window', ventanaFalsa())
    expect(transicionActiva()).toBe(true)
    await conTransicion(actualizar)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(actualizar).toHaveBeenCalledTimes(2)

    vi.stubGlobal('window', ventanaFalsa({ reducido: true }))
    expect(transicionActiva()).toBe(false)
    await conTransicion(actualizar)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(actualizar).toHaveBeenCalledTimes(3)
  })
})

describe('nombrarCompartido', () => {
  it('deja el nombre en un solo elemento', () => {
    const a = { style: {} }
    const b = { style: {} }
    nombrarCompartido(a)
    expect(a.style.viewTransitionName).toBe('carta')
    nombrarCompartido(b)
    expect(a.style.viewTransitionName).toBe('')
    expect(b.style.viewTransitionName).toBe('carta')
    nombrarCompartido(null)
  })
})

describe('revelar', () => {
  it('muestra el elemento al momento si no hay IntersectionObserver', () => {
    const el = { dataset: { revelar: '' }, style: estiloFalso() }
    expect(revelar(el)).toBeUndefined()
    expect(el.dataset.revelar).toBe('visto')
  })
})

describe('calcularInclinacion', () => {
  it('gira hacia el puntero sin pasar del máximo', () => {
    expect(calcularInclinacion(0.5, 0.5)).toEqual({ rx: 0, ry: 0, brillo: 50 })
    expect(calcularInclinacion(1, 0)).toEqual({ rx: INCLINACION_MAX, ry: INCLINACION_MAX, brillo: 100 })
    expect(calcularInclinacion(-3, 9)).toEqual({ rx: -INCLINACION_MAX, ry: -INCLINACION_MAX, brillo: 0 })
  })
})

describe('activarInclinacion', () => {
  function montar(opciones) {
    const ventana = ventanaFalsa(opciones)
    vi.stubGlobal('window', ventana)
    const frames = []
    vi.stubGlobal('requestAnimationFrame', (fn) => frames.push(fn))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const carta = {
      dataset: {},
      style: estiloFalso(),
      getBoundingClientRect: vi.fn(() => ({ left: 100, top: 100, width: 200, height: 300 })),
    }
    const hijo = { closest: () => carta }
    const listeners = {}
    const contenedor = {
      addEventListener: (tipo, fn) => (listeners[tipo] = fn),
      removeEventListener: (tipo) => delete listeners[tipo],
      contains: () => true,
    }
    const quitar = activarInclinacion(contenedor)
    return { carta, hijo, listeners, frames, quitar, ventana }
  }

  it('delegada en el contenedor, una lectura de caja y un frame por movimiento', () => {
    const { carta, hijo, listeners, frames, quitar } = montar()
    listeners.pointermove({ pointerType: 'mouse', target: hijo, clientX: 300, clientY: 100 })
    listeners.pointermove({ pointerType: 'mouse', target: hijo, clientX: 300, clientY: 100 })
    expect(frames).toHaveLength(1)
    expect(carta.getBoundingClientRect).toHaveBeenCalledTimes(1)
    expect(carta.dataset.inclinada).toBe('')
    frames[0]()
    expect(carta.style.props).toEqual({ '--rx': '8.00deg', '--ry': '8.00deg', '--brillo': '100.0' })

    listeners.pointerleave()
    expect(carta.style.props).toEqual({})
    expect(carta.dataset.inclinada).toBeUndefined()
    quitar()
    expect(listeners.pointermove).toBeUndefined()
  })

  it('no hace nada al mover el puntero por el hueco entre cartas', () => {
    const { listeners, frames } = montar()
    const hueco = { closest: () => null }
    expect(() => listeners.pointermove({ pointerType: 'mouse', target: hueco, clientX: 1, clientY: 1 })).not.toThrow()
    expect(() => listeners.pointermove({ pointerType: 'mouse', target: hueco, clientX: 2, clientY: 2 })).not.toThrow()
    expect(frames).toHaveLength(0)
  })

  it('ignora el tacto', () => {
    const { hijo, listeners, frames } = montar()
    listeners.pointermove({ pointerType: 'touch', target: hijo, clientX: 1, clientY: 1 })
    expect(frames).toHaveLength(0)
  })

  it('no se activa con movimiento reducido ni sin puntero fino', () => {
    expect(montar({ reducido: true }).listeners.pointermove).toBeUndefined()
    expect(montar({ hover: false }).listeners.pointermove).toBeUndefined()
  })
})
