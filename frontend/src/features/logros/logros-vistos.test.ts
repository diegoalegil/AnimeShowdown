import { beforeEach, describe, expect, it } from 'vitest'
import { leerLogrosVistos, marcarLogrosVistos } from './logros-vistos'

const KEY = 'animeshowdown.logros.vistos.v1'

beforeEach(() => {
  localStorage.removeItem(KEY)
})

describe('logros-vistos', () => {
  it('vacío al principio y persiste de forma idempotente', () => {
    expect(leerLogrosVistos().size).toBe(0)
    marcarLogrosVistos(['a', 'b'])
    marcarLogrosVistos(['b', 'c'])
    const set = leerLogrosVistos()
    expect([...set].sort()).toEqual(['a', 'b', 'c'])
  })

  it('datos corruptos no rompen (vuelve al set vacío)', () => {
    localStorage.setItem(KEY, '{no-json')
    expect(leerLogrosVistos().size).toBe(0)
    localStorage.setItem(KEY, JSON.stringify({ no: 'lista' }))
    expect(leerLogrosVistos().size).toBe(0)
    localStorage.setItem(KEY, JSON.stringify(['ok', 7, null]))
    expect([...leerLogrosVistos()]).toEqual(['ok'])
  })
})
