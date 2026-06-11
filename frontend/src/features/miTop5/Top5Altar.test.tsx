import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { COMPOSICIONES, KANJI_RANGO } from './top5-altar'
import { TOP5_CANVAS_THEME, drawTop5Background, drawTop5Numeral } from './top5-canvas-theme'

vi.mock('../../lib/personajes-core', () => ({
  getPersonajeBySlug: () => null,
  imagenPersonaje: (slug: string) => `/img/X/${slug}.webp`,
  CATALOGO_PERSONAJES_HYDRATED_EVENT: 'catalog-hydrated',
  MISSING_IMAGE_PREFIX: '/img/_missing/',
}))

import Top5Altar from './Top5Altar'

afterEach(() => cleanup())

describe('top5-altar helpers', () => {
  it('cada composición trae 5 pedestales y el fog nunca va en el nodo 3D', () => {
    for (const cfg of Object.values(COMPOSICIONES)) {
      expect(cfg).toHaveLength(5)
      expect(cfg.every((p) => p.fog > 0 && p.fog <= 1)).toBe(true)
    }
    expect(KANJI_RANGO).toEqual(['一', '二', '三', '四', '五'])
  })
})

describe('Top5Altar (fallback plano)', () => {
  it('en jsdom (sin matchMedia ≥640) degrada al grid de Top5Slot', () => {
    // jsdom matchMedia no existe o no matchea → capaz=false → grid compacto
    const slots = ['luffy', null, null, null, null]
    const personajes = new Map([['luffy', { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' }]])
    render(<Top5Altar slots={slots} personajesBySlug={personajes} onQuitar={() => {}} />)
    expect(screen.getByText('Monkey D. Luffy')).toBeInTheDocument()
  })
})

describe('top5-canvas-theme (corte carmesí)', () => {
  function stubCtx() {
    const target = { measureText: () => ({ width: 80 }) }
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

  it('el fondo y los numerales recorren su geometría sin tirar', () => {
    expect(() => drawTop5Background(stubCtx(), { width: 1200, height: 630 })).not.toThrow()
    for (let i = 0; i < 5; i++) {
      expect(() => drawTop5Numeral(stubCtx(), i, 100, 100)).not.toThrow()
    }
  })

  it('mantiene las claves antiguas del dibujo con valores on-brand', () => {
    expect(TOP5_CANVAS_THEME.background).toBeTruthy()
    expect(TOP5_CANVAS_THEME.accent).toBeTruthy()
    expect(TOP5_CANVAS_THEME.auroraStart).toContain('159')
  })
})
