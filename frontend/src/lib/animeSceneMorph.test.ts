import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  markAnimeScene,
  mountSceneCard,
  mountSceneHero,
  peekAnimeSceneMorphEntry,
} from './animeSceneMorph'
import {
  ANIME_SCENE_VT,
  animeSceneMorph,
  settleNavigationViewTransition,
  startNavigationViewTransition,
} from './viewTransitions'

type TransitionFake = {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
}

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

// jsdom devuelve rects a cero: la visibilidad de la cover se stubea por
// elemento. height 400 con bottom 400 ⇒ 100% visible; bottom 40 ⇒ 10%,
// por debajo de la cuota del 35%.
function crearCover(visible = true) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: visible ? 400 : 40, height: 400 }) as unknown as DOMRect
  return el
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // El módulo guarda registro/holder a nivel de módulo a propósito: cada
  // test consume su propio flujo (cleanups + settle) y aquí solo se asienta
  // lo pendiente y se vacía el DOM.
  settleNavigationViewTransition()
  delete doc.startViewTransition
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('morph scene → hero (catálogo de animes)', () => {
  it('la ida marca la cover registrada y el hero consume la señal al adoptar', () => {
    instalarStartViewTransition()
    const cover = crearCover()
    const limpiarCard = mountSceneCard(cover, 'naruto')

    markAnimeScene('naruto')
    expect(nombreDe(cover)).toBe(ANIME_SCENE_VT)
    expect(peekAnimeSceneMorphEntry()).toBe(true)

    const hero = crearCover()
    const limpiarHero = mountSceneHero(hero, 'naruto')
    // El adopt consume la señal de entrada-vía-morph y hace swap del holder.
    expect(peekAnimeSceneMorphEntry()).toBe(false)
    expect(nombreDe(hero)).toBe(ANIME_SCENE_VT)
    expect(nombreDe(cover)).toBe('')

    limpiarHero()
    limpiarCard()
    // Drena el returnSlug que dejó el hero para no filtrarlo a otros tests.
    mountSceneCard(crearCover(), 'naruto')()
    settleNavigationViewTransition()
  })

  it('una cover sin registrar no marca nada (grid filtrado, lazy aún sin montar)', () => {
    instalarStartViewTransition()
    markAnimeScene('slug-inexistente')
    expect(peekAnimeSceneMorphEntry()).toBe(false)
  })

  it('la vuelta contrae el hero hacia su card: adopción transitoria en el settle', async () => {
    const { startViewTransition } = instalarStartViewTransition()
    const hero = crearCover()
    const limpiarHero = mountSceneHero(hero, 'one-piece')

    // Navegación detalle → catálogo: la captura vieja lleva el hero nombrado…
    startNavigationViewTransition(vi.fn())
    limpiarHero() // …el commit desmonta el detalle…
    const cover = crearCover()
    const limpiarCard = mountSceneCard(cover, 'one-piece') // …y monta el grid.

    // La card no decide sola: encola y el settle (scroll ya reseteado) ejecuta.
    expect(nombreDe(cover)).toBe('')
    settleNavigationViewTransition()
    expect(nombreDe(cover)).toBe(ANIME_SCENE_VT)

    // Marca transitoria: el finished la limpia y el grid queda sin residuos.
    await startViewTransition.mock.results[0].value.finished
    await Promise.resolve()
    expect(nombreDe(cover)).toBe('')
    limpiarCard()
  })

  it('sin hero en la captura vieja la card no adopta (returnSlug rancio)', () => {
    instalarStartViewTransition()
    const hero = crearCover()
    // El detalle se visitó y se abandonó FUERA de esta transición.
    mountSceneHero(hero, 'bleach')()

    // Navegación cualquiera → catálogo: el grupo no tendría origen.
    startNavigationViewTransition(vi.fn())
    const cover = crearCover()
    const limpiarCard = mountSceneCard(cover, 'bleach')
    settleNavigationViewTransition()
    expect(nombreDe(cover)).toBe('')
    limpiarCard()
  })

  it('con la card por debajo de la cuota visible la vuelta corta limpia', () => {
    instalarStartViewTransition()
    const hero = crearCover()
    const limpiarHero = mountSceneHero(hero, 'dragon-ball')

    startNavigationViewTransition(vi.fn())
    limpiarHero()
    const cover = crearCover(false) // 10% visible, bajo la cuota del 35%
    const limpiarCard = mountSceneCard(cover, 'dragon-ball')
    settleNavigationViewTransition()
    expect(nombreDe(cover)).toBe('')
    limpiarCard()
  })

  it('una vuelta sin transición (popstate) no deja marca residual', () => {
    instalarStartViewTransition()
    const hero = crearCover()
    mountSceneHero(hero, 'gintama')()

    // Sin startNavigationViewTransition: App.jsx asienta igualmente en el
    // commit y la adopción encolada se descarta sin ejecutarse.
    const cover = crearCover()
    const limpiarCard = mountSceneCard(cover, 'gintama')
    settleNavigationViewTransition()
    expect(nombreDe(cover)).toBe('')
    limpiarCard()
  })

  it('sin soporte de view transitions todo es no-op (ni marca ni señal)', () => {
    const cover = crearCover()
    const limpiarCard = mountSceneCard(cover, 'haikyuu')
    markAnimeScene('haikyuu')
    expect(nombreDe(cover)).toBe('')
    expect(peekAnimeSceneMorphEntry()).toBe(false)
    limpiarCard()
  })
})
