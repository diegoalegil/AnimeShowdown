import { afterEach, describe, expect, it } from 'vitest'
import {
  GLOBAL_KILL_KEY,
  SEASONAL_EVENTS,
  dentroDeVentana,
  eventoVisible,
  rutasCalmas,
} from './seasonal-events'

const tanabata = SEASONAL_EVENTS.find((e) => e.id === 'tanabata')!
const enTanabata = new Date(2026, 6, 3) // 3 jul
const fueraDeTanabata = new Date(2026, 2, 3) // 3 mar

describe('seasonal-events — ventanas', () => {
  it('detecta dentro/fuera de una ventana normal', () => {
    expect(dentroDeVentana(tanabata.ventana, enTanabata)).toBe(true)
    expect(dentroDeVentana(tanabata.ventana, new Date(2026, 6, 1))).toBe(true)
    expect(dentroDeVentana(tanabata.ventana, new Date(2026, 6, 7))).toBe(true)
    expect(dentroDeVentana(tanabata.ventana, new Date(2026, 6, 8))).toBe(false)
    expect(dentroDeVentana(tanabata.ventana, fueraDeTanabata)).toBe(false)
  })

  it('soporta ventanas que cruzan el cambio de año (28 dic – 7 ene)', () => {
    const anioNuevo = SEASONAL_EVENTS.find((e) => e.id === 'anio-nuevo')!
    expect(dentroDeVentana(anioNuevo.ventana, new Date(2026, 11, 30))).toBe(true)
    expect(dentroDeVentana(anioNuevo.ventana, new Date(2027, 0, 3))).toBe(true)
    expect(dentroDeVentana(anioNuevo.ventana, new Date(2026, 5, 15))).toBe(false)
  })
})

describe('seasonal-events — rutas calmas', () => {
  it('vive en home y catálogos, jamás en flujos de voto/juego', () => {
    expect(rutasCalmas('/')).toBe(true)
    expect(rutasCalmas('/personajes')).toBe(true)
    expect(rutasCalmas('/personajes/luffy')).toBe(true)
    expect(rutasCalmas('/animes/one-piece')).toBe(true)
    expect(rutasCalmas('/votar')).toBe(false)
    expect(rutasCalmas('/games/anigrid')).toBe(false)
    expect(rutasCalmas('/torneos')).toBe(false)
  })
})

describe('seasonal-events — gate completo', () => {
  afterEach(() => {
    localStorage.removeItem(GLOBAL_KILL_KEY)
    localStorage.removeItem(tanabata.storageKey)
  })

  it('visible dentro de ventana en ruta calma', () => {
    expect(eventoVisible(tanabata, '/', enTanabata)).toBe(true)
  })

  it('invisible fuera de ventana, en ruta no-calma o sin Component', () => {
    expect(eventoVisible(tanabata, '/', fueraDeTanabata)).toBe(false)
    expect(eventoVisible(tanabata, '/votar', enTanabata)).toBe(false)
    const slotVacio = SEASONAL_EVENTS.find((e) => e.id === 'tsukimi')!
    expect(eventoVisible(slotVacio, '/', new Date(2026, 9, 3))).toBe(false)
  })

  it('el kill global y el kill por evento apagan; el force enciende fuera de ventana', () => {
    localStorage.setItem(GLOBAL_KILL_KEY, 'off')
    expect(eventoVisible(tanabata, '/', enTanabata)).toBe(false)
    localStorage.removeItem(GLOBAL_KILL_KEY)

    localStorage.setItem(tanabata.storageKey, 'off')
    expect(eventoVisible(tanabata, '/', enTanabata)).toBe(false)

    localStorage.setItem(tanabata.storageKey, 'on')
    expect(eventoVisible(tanabata, '/', fueraDeTanabata)).toBe(true)
    // El force respeta la discreción por ruta.
    expect(eventoVisible(tanabata, '/votar', fueraDeTanabata)).toBe(false)
  })
})
