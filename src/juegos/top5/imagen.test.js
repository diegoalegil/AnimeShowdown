import { describe, expect, it } from 'vitest'
import { ALTO, ANCHO, TOKENS, disposicion, paletaDesde, truncar } from './imagen.js'

describe('disposicion', () => {
  it('coloca cinco cartas dentro del lienzo, sin solaparse, con la primera mayor', () => {
    const p = disposicion()
    expect(p).toHaveLength(5)
    expect(p.map((c) => c.numeral)).toEqual(['一', '二', '三', '四', '五'])
    for (const c of p) {
      expect(c.x).toBeGreaterThan(0)
      expect(c.x + c.w).toBeLessThan(ANCHO)
      expect(c.y).toBeGreaterThan(100) // bajo el título
      expect(c.y + c.h).toBeLessThan(ALTO)
    }
    for (let i = 1; i < 5; i++) expect(p[i].x).toBeGreaterThan(p[i - 1].x + p[i - 1].w)
    expect(p[0].w).toBeGreaterThan(p[1].w)
    expect(p[1].w).toBe(p[4].w)
  })
})

describe('truncar', () => {
  const medir = (t) => t.length * 10
  it('deja el texto si cabe y lo acorta con puntos suspensivos si no', () => {
    expect(truncar(medir, 'Goku', 100)).toBe('Goku')
    expect(truncar(medir, 'Monkey D. Luffy', 80)).toBe('Monkey…')
    expect(truncar(medir, 'ab', 10)).toBe('a…')
  })
})

describe('paletaDesde', () => {
  it('sin documento usa los colores de respaldo de cada token', () => {
    const paleta = paletaDesde(undefined)
    for (const [clave, [, respaldo]] of Object.entries(TOKENS)) expect(paleta[clave]).toBe(respaldo)
  })

  it('lee los tokens cuando el elemento los tiene', () => {
    const original = globalThis.getComputedStyle
    globalThis.getComputedStyle = () => ({ getPropertyValue: (t) => (t === '--color-gold' ? ' oro ' : '') })
    try {
      const paleta = paletaDesde({})
      expect(paleta.oro).toBe('oro')
      expect(paleta.lienzo).toBe(TOKENS.lienzo[1])
    } finally {
      globalThis.getComputedStyle = original
    }
  })
})
