import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANIME_SCENE_VT,
  PERSONAJE_HERO_VT,
  adoptPersonajeHero,
  animeSceneMorph,
  markPersonajeHero,
  queueSettleAdopt,
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

// Los elementos van appendeados al body: el afterEach localiza al holder del
// morph por su atributo style, y un nodo suelto (sin appendear) dejaría el
// heroHolder a nivel de módulo filtrado al test siguiente.
function crearElemento(tag: string) {
  const el = document.createElement(tag)
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Asentar lo pendiente y soltar los holders de los morphs entre tests: la
  // lib guarda estado a nivel de módulo a propósito (un solo nombre por
  // captura). release() es seguro sobre el holder ajeno (solo limpia estilo).
  settleNavigationViewTransition()
  for (const el of document.querySelectorAll('[style*="view-transition-name"]')) {
    releasePersonajeHero(el as HTMLElement)
    animeSceneMorph.release(el as HTMLElement)
  }
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
    const carta = crearElemento('article')
    markPersonajeHero(carta)
    expect(nombreDe(carta)).toBe('')
  })

  it('marca la carta clickada con el nombre compartido', () => {
    instalarStartViewTransition()
    const carta = crearElemento('article')
    markPersonajeHero(carta)
    expect(nombreDe(carta)).toBe(PERSONAJE_HERO_VT)
  })

  it('solo un elemento conserva el nombre: marcar libera al holder anterior', () => {
    instalarStartViewTransition()
    const hero = crearElemento('div')
    const carta = crearElemento('article')

    adoptPersonajeHero(hero)
    expect(nombreDe(hero)).toBe(PERSONAJE_HERO_VT)

    markPersonajeHero(carta)
    expect(nombreDe(hero)).toBe('')
    expect(nombreDe(carta)).toBe(PERSONAJE_HERO_VT)
  })

  it('release limpia el nombre y deja adoptar a otro elemento', () => {
    instalarStartViewTransition()
    const hero = crearElemento('div')
    adoptPersonajeHero(hero)
    releasePersonajeHero(hero)
    expect(nombreDe(hero)).toBe('')

    const otro = crearElemento('div')
    adoptPersonajeHero(otro)
    expect(nombreDe(otro)).toBe(PERSONAJE_HERO_VT)
  })

  it('al terminar la transición se limpia la marca transitoria, no la adoptada', async () => {
    const { startViewTransition } = instalarStartViewTransition()

    const carta = crearElemento('article')
    markPersonajeHero(carta)
    startNavigationViewTransition(vi.fn())
    settleNavigationViewTransition()
    await startViewTransition.mock.results[0].value.finished
    await Promise.resolve()
    expect(nombreDe(carta)).toBe('')

    const hero = crearElemento('div')
    adoptPersonajeHero(hero)
    startNavigationViewTransition(vi.fn())
    settleNavigationViewTransition()
    await startViewTransition.mock.results[1].value.finished
    await Promise.resolve()
    expect(nombreDe(hero)).toBe(PERSONAJE_HERO_VT)
  })
})

describe('morphs compartidos (factoría)', () => {
  it('anime-scene y personaje-hero son holders independientes', () => {
    instalarStartViewTransition()
    const hero = crearElemento('div')
    const cover = crearElemento('div')

    adoptPersonajeHero(hero)
    animeSceneMorph.adopt(cover)
    expect(nombreDe(hero)).toBe(PERSONAJE_HERO_VT)
    expect(nombreDe(cover)).toBe(ANIME_SCENE_VT)

    // Marcar/liberar en un grupo no toca al otro.
    animeSceneMorph.release(cover)
    expect(nombreDe(cover)).toBe('')
    expect(nombreDe(hero)).toBe(PERSONAJE_HERO_VT)
  })

  it('la marca transitoria de anime-scene se limpia al terminar la transición', async () => {
    const { startViewTransition } = instalarStartViewTransition()
    const cover = crearElemento('div')
    animeSceneMorph.mark(cover)
    startNavigationViewTransition(vi.fn())
    settleNavigationViewTransition()
    await startViewTransition.mock.results[0].value.finished
    await Promise.resolve()
    expect(nombreDe(cover)).toBe('')
  })

  it('heldAtCapture refleja si el nombre viajaba en la captura del estado viejo', () => {
    instalarStartViewTransition()
    const cover = crearElemento('div')

    animeSceneMorph.adopt(cover)
    startNavigationViewTransition(vi.fn())
    expect(animeSceneMorph.heldAtCapture()).toBe(true)
    settleNavigationViewTransition()

    animeSceneMorph.release(cover)
    startNavigationViewTransition(vi.fn())
    expect(animeSceneMorph.heldAtCapture()).toBe(false)
    settleNavigationViewTransition()
  })
})

describe('queueSettleAdopt', () => {
  it('ejecuta la adopción encolada en el settle, antes de resolver la captura nueva', async () => {
    const { startViewTransition } = instalarStartViewTransition()
    const adopt = vi.fn()

    startNavigationViewTransition(vi.fn())
    queueSettleAdopt(adopt)
    expect(adopt).not.toHaveBeenCalled()

    settleNavigationViewTransition()
    expect(adopt).toHaveBeenCalledTimes(1)
    await startViewTransition.mock.results[0].value.updateCallbackDone
  })

  it('descarta la adopción sin transición pendiente (popstate) y no la filtra después', () => {
    instalarStartViewTransition()
    const adopt = vi.fn()

    // App.jsx asienta en cada commit de ruta; sin transición la cola se vacía
    // sin ejecutarse (marcar dejaría un nombre residual sin quien lo limpie).
    queueSettleAdopt(adopt)
    settleNavigationViewTransition()
    expect(adopt).not.toHaveBeenCalled()

    startNavigationViewTransition(vi.fn())
    settleNavigationViewTransition()
    expect(adopt).not.toHaveBeenCalled()
  })
})
