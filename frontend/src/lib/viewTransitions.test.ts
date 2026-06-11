import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PERSONAJE_HERO_VT,
  adoptPersonajeHero,
  markPersonajeHero,
  releasePersonajeHero,
  settleNavigationViewTransition,
  startNavigationViewTransition,
  supportsViewTransitions,
} from './viewTransitions'

type TransitionFake = {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
}

// Cast laxo a propósito: el lib.dom ya tipa startViewTransition con la firma
// real del navegador y aquí se instala/borra un fake mínimo por test.
const doc = document as unknown as {
  startViewTransition?: (cb: () => Promise<void>) => TransitionFake
}

function instalarStartViewTransition() {
  const transition = {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
  }
  const startViewTransition = vi.fn((cb: () => Promise<void>) => {
    transition.updateCallbackDone = cb()
    return transition
  })
  doc.startViewTransition = startViewTransition
  return { startViewTransition, transition }
}

function nombreDe(el: HTMLElement) {
  return el.style.getPropertyValue('view-transition-name')
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Asentar lo pendiente y soltar el holder del morph entre tests: la lib
  // guarda estado a nivel de módulo a propósito (un solo nombre por captura).
  settleNavigationViewTransition()
  releasePersonajeHero(document.querySelector('[style*="view-transition-name"]') as HTMLElement)
  delete doc.startViewTransition
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('supportsViewTransitions', () => {
  it('es false sin document.startViewTransition (no-op limpio en Firefox/legacy)', () => {
    expect(supportsViewTransitions()).toBe(false)
  })

  it('es true con startViewTransition disponible y sin reduced motion', () => {
    instalarStartViewTransition()
    expect(supportsViewTransitions()).toBe(true)
  })

  it('es false con prefers-reduced-motion: reduce aunque haya soporte', () => {
    instalarStartViewTransition()
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as typeof window.matchMedia
    try {
      expect(supportsViewTransitions()).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })
})

describe('startNavigationViewTransition', () => {
  it('navega directo cuando no hay soporte', () => {
    const navigateFn = vi.fn()
    startNavigationViewTransition(navigateFn)
    expect(navigateFn).toHaveBeenCalledTimes(1)
  })

  it('envuelve la navegación y espera el settle del commit', async () => {
    const { startViewTransition } = instalarStartViewTransition()
    const navigateFn = vi.fn()
    let resuelta = false

    startNavigationViewTransition(navigateFn)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(navigateFn).toHaveBeenCalledTimes(1)

    const pendiente = startViewTransition.mock.results[0].value.updateCallbackDone.then(() => {
      resuelta = true
    })
    await Promise.resolve()
    expect(resuelta).toBe(false)

    settleNavigationViewTransition()
    await pendiente
    expect(resuelta).toBe(true)
  })

  it('asienta solo por watchdog si el commit nunca llega', async () => {
    const { startViewTransition } = instalarStartViewTransition()
    startNavigationViewTransition(vi.fn())

    vi.advanceTimersByTime(1500)
    await startViewTransition.mock.results[0].value.updateCallbackDone
  })
})

describe('morph personaje-hero', () => {
  it('sin soporte no marca nada (los nombres solo aparecen donde hay API)', () => {
    const carta = document.createElement('article')
    markPersonajeHero(carta)
    expect(nombreDe(carta)).toBe('')
  })

  it('marca la carta clickada con el nombre compartido', () => {
    instalarStartViewTransition()
    const carta = document.createElement('article')
    markPersonajeHero(carta)
    expect(nombreDe(carta)).toBe(PERSONAJE_HERO_VT)
  })

  it('solo un elemento conserva el nombre: marcar libera al holder anterior', () => {
    instalarStartViewTransition()
    const hero = document.createElement('div')
    const carta = document.createElement('article')

    adoptPersonajeHero(hero)
    expect(nombreDe(hero)).toBe(PERSONAJE_HERO_VT)

    markPersonajeHero(carta)
    expect(nombreDe(hero)).toBe('')
    expect(nombreDe(carta)).toBe(PERSONAJE_HERO_VT)
  })

  it('release limpia el nombre y deja adoptar a otro elemento', () => {
    instalarStartViewTransition()
    const hero = document.createElement('div')
    adoptPersonajeHero(hero)
    releasePersonajeHero(hero)
    expect(nombreDe(hero)).toBe('')

    const otro = document.createElement('div')
    adoptPersonajeHero(otro)
    expect(nombreDe(otro)).toBe(PERSONAJE_HERO_VT)
  })

  it('al terminar la transición se limpia la marca transitoria, no la adoptada', async () => {
    const { startViewTransition } = instalarStartViewTransition()

    const carta = document.createElement('article')
    markPersonajeHero(carta)
    startNavigationViewTransition(vi.fn())
    settleNavigationViewTransition()
    await startViewTransition.mock.results[0].value.finished
    await Promise.resolve()
    expect(nombreDe(carta)).toBe('')

    const hero = document.createElement('div')
    adoptPersonajeHero(hero)
    startNavigationViewTransition(vi.fn())
    settleNavigationViewTransition()
    await startViewTransition.mock.results[1].value.finished
    await Promise.resolve()
    expect(nombreDe(hero)).toBe(PERSONAJE_HERO_VT)
  })
})
