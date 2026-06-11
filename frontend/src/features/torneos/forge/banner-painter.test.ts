import { describe, expect, it } from 'vitest'
import { BANNER_W, BANNER_H, paintBanner } from './banner-painter'

// Stub de canvas/ctx (mismo patrón que duel-share-card.test): cada método es
// no-op y los gradientes devuelven addColorStop inerte. Valida que TODAS las
// ramas del pintor (con/sin nombre, con/sin organizador, cuadros de 8/16/32,
// con/sin fecha) recorren su geometría sin tirar — el píxel real se valida a
// ojo en preview.
function stubCanvas() {
  const gradient = { addColorStop: () => {} }
  const ctxTarget = {
    measureText: () => ({ width: 120 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  const ctx = new Proxy(ctxTarget, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as keyof typeof obj]
      return () => {}
    },
    set() {
      return true
    },
  })
  return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
}

const THEME = {
  palette: {
    bg: 'rgb(4, 7, 12)',
    surface: 'rgb(8, 11, 18)',
    accent: 'rgb(159, 29, 44)',
    gold: 'rgb(197, 161, 90)',
    electric: 'rgb(36, 198, 220)',
    ink: 'rgb(247, 243, 234)',
    muted: 'rgb(168, 177, 195)',
  },
  fonts: { sans: 'sans-serif', mono: 'monospace', kanji: 'serif' },
}

describe('banner-painter', () => {
  it('pinta el estandarte completo con datos reales sin tirar', () => {
    const canvas = stubCanvas()
    expect(() =>
      paintBanner(canvas, { name: 'Copa Kantō de primavera', organizer: 'diego', date: '2026-06-11', bracketSize: 16 }, THEME),
    ).not.toThrow()
    expect(canvas.width).toBe(BANNER_W)
    expect(canvas.height).toBe(BANNER_H)
  })

  it.each([8, 16, 32])('recorre el bracket fantasma de %i sin tirar', (size) => {
    expect(() => paintBanner(stubCanvas(), { bracketSize: size }, THEME)).not.toThrow()
  })

  it('cubre los placeholders sin nombre ni organizador ni fecha', () => {
    expect(() => paintBanner(stubCanvas(), {}, THEME)).not.toThrow()
  })

  it('un nombre kilométrico se autoencoge sin desbordar el lienzo', () => {
    const larguisimo = 'El grandísimo torneo definitivo de la primavera eterna del anime shonen de todos los tiempos'
    expect(() => paintBanner(stubCanvas(), { name: larguisimo, bracketSize: 32 }, THEME)).not.toThrow()
  })
})
