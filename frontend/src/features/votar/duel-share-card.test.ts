import { describe, expect, it } from 'vitest'
import { DUEL_CARD_SIZE, drawDuelShareCard, slug } from './duel-share-card'

// Stub de CanvasRenderingContext2D: cada método es no-op y los gradientes
// devuelven addColorStop inerte. Suficiente para validar que TODAS las
// ramas del pintor (ganador izq/dcha, empate, placeholder, ambos layouts)
// recorren su geometría sin tirar — el píxel real se valida a ojo en preview.
function stubCtx() {
  const gradient = { addColorStop: () => {} }
  const target = {
    canvas: { width: DUEL_CARD_SIZE, height: DUEL_CARD_SIZE },
    measureText: () => ({ width: 120 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    roundRect: undefined, // fuerza la rama de fallback con arcTo
  }
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as keyof typeof obj]
      return () => {}
    },
    set() {
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

const THEME = {
  bg: 'rgb(4, 7, 12)',
  surface: 'rgb(8, 11, 18)',
  accent: 'rgb(159, 29, 44)',
  gold: 'rgb(197, 161, 90)',
  electric: 'rgb(36, 198, 220)',
  text: 'rgb(215, 220, 231)',
  muted: 'rgb(168, 177, 195)',
  fontJp: 'serif',
}

const DUEL = {
  left: { name: 'Naruto Uzumaki', anime: 'Naruto', image: '/img/Naruto/naruto-600.webp' },
  right: { name: 'Luffy', anime: 'One Piece', image: '/img/One_Piece/luffy-600.webp' },
  leftPct: 62,
}

describe('drawDuelShareCard', () => {
  it.each([
    ['ganador a la izquierda', { ...DUEL, leftPct: 62 }],
    ['ganador a la derecha', { ...DUEL, leftPct: 30 }],
    ['empate 50/50 sin oro', { ...DUEL, leftPct: 50 }],
  ])('pinta sin tirar — %s', (_caso, duel) => {
    expect(() =>
      drawDuelShareCard(stubCtx(), duel, {
        theme: THEME,
        images: { left: null, right: null },
      }),
    ).not.toThrow()
  })

  it('pinta el layout frontal y normaliza un % fuera de rango', () => {
    expect(() =>
      drawDuelShareCard(stubCtx(), { ...DUEL, leftPct: 140 }, {
        theme: THEME,
        layout: 'frontal',
        images: { left: null, right: null },
      }),
    ).not.toThrow()
  })
})

describe('slug', () => {
  it('normaliza nombres con acentos y símbolos al formato de /img', () => {
    expect(slug('Gabimaru "el Vacío"')).toBe('gabimaru-el-vacio')
    expect(slug('   Región—X ')).toBe('region-x')
  })
})
