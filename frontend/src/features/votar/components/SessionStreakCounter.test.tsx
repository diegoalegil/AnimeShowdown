import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import SessionStreakCounter from './SessionStreakCounter'

// El contador es imperativo a propósito (cero estado React por voto): el
// contrato vive en el DOM (data-state / data-tier / textContent) y en
// sessionStorage. happy-dom no trae WAAPI, así que animate/getAnimations
// se stubean aquí; los tests de coreografía solo asertan QUE se anima,
// nunca frames.

const STORAGE_KEY = 'animeshowdown.sessionStreak.v1'

const animateCalls: Array<{ target: Element; options: KeyframeAnimationOptions }> = []
const proto = Element.prototype as unknown as Record<string, unknown>

beforeEach(() => {
  vi.useFakeTimers()
  animateCalls.length = 0
  proto.animate = function animateStub(
    this: Element,
    _frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    animateCalls.push({ target: this, options })
    return { cancel: vi.fn(), finished: new Promise(() => {}) }
  }
  proto.getAnimations = () => []
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.useRealTimers()
  delete proto.animate
  delete proto.getAnimations
})

function mount(props: Record<string, unknown> = {}) {
  let listener: (() => void) | null = null
  const unsubscribe = vi.fn(() => {
    listener = null
  })
  const subscribe = vi.fn((l: () => void) => {
    listener = l
    return unsubscribe
  })
  const utils = render(
    <SessionStreakCounter subscribe={subscribe} reducedMotion {...props} />,
  )
  const root = utils.container.querySelector('.streak-counter') as HTMLElement
  return {
    ...utils,
    subscribe,
    unsubscribe,
    root,
    vote: () => act(() => listener?.()),
    num: () => root.querySelector('.streak-counter__num')?.textContent,
    sr: () => root.querySelector('[role="status"]')?.textContent,
    rings: () => root.querySelectorAll('.streak-counter__enso-path'),
  }
}

function seed(c: unknown, ts: number = Date.now()) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ c, ts }))
}

describe('SessionStreakCounter — arranque y votos', () => {
  it('sin sesión previa arranca vacío y dormido', () => {
    const { root, num, sr } = mount()
    expect(num()).toBe('0')
    expect(root.dataset.state).toBe('empty')
    expect(root.dataset.tier).toBe('0')
    expect(sr()).toBe('')
  })

  it('cada voto estampa la cifra, enciende el marcador y persiste', () => {
    const { root, num, vote } = mount()
    vote()
    vote()
    vote()
    expect(num()).toBe('3')
    expect(root.dataset.state).toBe('live')
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(saved).toEqual({ c: 3, ts: Date.now() })
  })

  it('el hito dispara onMilestone y sube el tier', () => {
    seed(9)
    const onMilestone = vi.fn()
    const { root, vote } = mount({ onMilestone })
    vote()
    expect(onMilestone).toHaveBeenCalledTimes(1)
    expect(onMilestone).toHaveBeenCalledWith(10)
    expect(root.dataset.tier).toBe('1')
  })

  it('desmontar suelta la suscripción y no deja timers vivos', () => {
    const { unsubscribe, unmount, vote } = mount()
    vote()
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('SessionStreakCounter — restauración de sessionStorage', () => {
  it('restaura la cifra y el tier ganados, sin ceremonia', () => {
    seed(26)
    const { root, num } = mount()
    expect(num()).toBe('26')
    expect(root.dataset.tier).toBe('2')
    expect(root.dataset.state).toBe('live')
    // anillo del primer hito en reposo (restaurado, no trazado)
    expect(animateCalls).toHaveLength(0)
  })

  it('con el último hito ganado, el doble trazo descansa ya dibujado', () => {
    seed(50)
    const { root, rings } = mount()
    expect(root.dataset.tier).toBe('3')
    const [ring1, ring2] = Array.from(rings())
    expect(ring1.classList.contains('is-resting')).toBe(true)
    expect(ring2.classList.contains('is-resting')).toBe(true)
  })

  it('la restauración respeta el decaimiento: brasa y sueño', () => {
    seed(7, Date.now() - 31_000)
    const a = mount()
    expect(a.num()).toBe('7')
    expect(a.root.dataset.state).toBe('ember')
    cleanup()

    seed(7, Date.now() - 121_000)
    const b = mount()
    expect(b.num()).toBe('7')
    expect(b.root.dataset.state).toBe('asleep')
  })

  it('descarta storage corrupto o sin racha real', () => {
    for (const raw of ['no-json', '{"c":"x"}', '{"c":0,"ts":1}', '{"c":-3,"ts":1}', '{"c":2.5,"ts":1}']) {
      sessionStorage.setItem(STORAGE_KEY, raw)
      const { root, num } = mount()
      expect(num()).toBe('0')
      expect(root.dataset.state).toBe('empty')
      cleanup()
    }
  })

  it('un voto despierta al marcador dormido por el camino normal', () => {
    seed(12, Date.now() - 200_000)
    const { root, num, vote } = mount()
    expect(root.dataset.state).toBe('asleep')
    vote()
    expect(num()).toBe('13')
    expect(root.dataset.state).toBe('live')
  })
})

describe('SessionStreakCounter — decaimiento y pestaña oculta', () => {
  it('sin votar baja a brasa y luego se duerme (la cifra nunca se resetea)', () => {
    const { root, num, vote } = mount()
    vote()
    act(() => vi.advanceTimersByTime(30_000))
    expect(root.dataset.state).toBe('ember')
    act(() => vi.advanceTimersByTime(90_000))
    expect(root.dataset.state).toBe('asleep')
    expect(num()).toBe('1')
  })

  it('oculta la pestaña: timers fuera; al volver recalcula sin animar', () => {
    const { root, vote } = mount()
    vote()
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(40_000))
    // el timer de brasa se limpió al ocultarse: el estado no avanzó solo
    expect(root.dataset.state).toBe('live')

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(root.dataset.state).toBe('ember')
  })
})

describe('SessionStreakCounter — lector de pantalla y coreografía', () => {
  it('anuncia la racha con throttle de 1s (ráfaga = como mucho 1 anuncio/s)', () => {
    const { sr, vote } = mount()
    vote()
    expect(sr()).toBe('racha de la sesión: 1')
    vote()
    vote()
    expect(sr()).toBe('racha de la sesión: 1')
    act(() => vi.advanceTimersByTime(1_000))
    expect(sr()).toBe('racha de la sesión: 3')
  })

  it('con movimiento, el voto estampa el punch y el hito traza el ensō', () => {
    seed(9)
    const { vote, num } = mount({ reducedMotion: false })
    vote()
    expect(num()).toBe('10')
    const duraciones = animateCalls.map((c) => c.options.duration)
    expect(duraciones).toContain(120) // punch del numeral
    expect(duraciones).toContain(500) // trazo del ensō del hito
  })

  it('con reduced motion no hay punch ni trazo: solo la cifra', () => {
    seed(9)
    const { vote, num } = mount({ reducedMotion: true })
    vote()
    expect(num()).toBe('10')
    expect(animateCalls).toHaveLength(0)
  })
})
