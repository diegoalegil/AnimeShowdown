import { describe, expect, it } from 'vitest'
import { DOJO_SCENES, sanitizeNext, sceneOfDay } from './dojo-login-data'

describe('sanitizeNext — anti open-redirect', () => {
  it('acepta solo rutas relativas propias', () => {
    expect(sanitizeNext('/votar')).toBe('/votar')
    expect(sanitizeNext('/torneos/crear?x=1')).toBe('/torneos/crear?x=1')
  })

  it('rechaza absolutas, protocol-relative y vacíos', () => {
    expect(sanitizeNext('https://evil.example')).toBe('/')
    expect(sanitizeNext('//evil.example')).toBe('/')
    expect(sanitizeNext('')).toBe('/')
    expect(sanitizeNext(null)).toBe('/')
  })
})

describe('sceneOfDay — rotación determinista por día UTC', () => {
  it('mismo día, misma escena; día siguiente, la siguiente', () => {
    const dia = 86400000
    const t0 = 20000 * dia
    const a = sceneOfDay(DOJO_SCENES, t0)
    expect(sceneOfDay(DOJO_SCENES, t0 + dia - 1)).toBe(a)
    expect(sceneOfDay(DOJO_SCENES, t0 + dia)).toBe(
      DOJO_SCENES[(20001) % DOJO_SCENES.length],
    )
  })

  it('sin escenas devuelve null en vez de romper', () => {
    expect(sceneOfDay([], 1)).toBeNull()
    expect(sceneOfDay(undefined, 1)).toBeNull()
  })
})
