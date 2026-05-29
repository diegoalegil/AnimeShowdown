import { describe, it, expect } from 'vitest'
import { generarSugerenciasUsername } from './username-suggestions'

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/

describe('generarSugerenciasUsername', () => {
  it('devuelve sugerencias válidas para el backend (3-30, alfanumérico + _-)', () => {
    const out = generarSugerenciasUsername('naruto')
    expect(out.length).toBeGreaterThan(0)
    for (const s of out) {
      expect(s.length).toBeGreaterThanOrEqual(3)
      expect(s.length).toBeLessThanOrEqual(30)
      expect(USERNAME_PATTERN.test(s)).toBe(true)
    }
  })

  it('es determinística: misma base → mismas sugerencias', () => {
    expect(generarSugerenciasUsername('sasuke')).toEqual(
      generarSugerenciasUsername('sasuke'),
    )
  })

  it('no repite sugerencias', () => {
    const out = generarSugerenciasUsername('goku')
    expect(new Set(out.map((s) => s.toLowerCase())).size).toBe(out.length)
  })

  it('usa la parte local de un email como base', () => {
    const out = generarSugerenciasUsername('fan.luffy@example.com')
    // ninguna sugerencia debe contener @ o . (caracteres no permitidos)
    for (const s of out) {
      expect(s).not.toMatch(/[@.]/)
    }
  })

  it('respeta el máximo de 30 incluso con bases largas', () => {
    const out = generarSugerenciasUsername('a'.repeat(40))
    for (const s of out) {
      expect(s.length).toBeLessThanOrEqual(30)
    }
  })

  it('cae a una base por defecto cuando la entrada queda vacía', () => {
    const out = generarSugerenciasUsername('@@@')
    expect(out.length).toBeGreaterThan(0)
    for (const s of out) {
      expect(USERNAME_PATTERN.test(s)).toBe(true)
    }
  })
})
