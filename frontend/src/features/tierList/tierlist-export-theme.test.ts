import { describe, expect, it, vi } from 'vitest'
import {
  TIER_CALIGRAFIA,
  TIER_KANJI,
  TIER_ORDER,
  TIERLIST_EXPORT_THEME,
  renderTierListExport,
} from './tierlist-export-theme'

// El pintor del PNG compartible (1200×630). Sin canvas real en happy-dom:
// un ctx grabador captura las llamadas y los tests asertan el contrato
// observable (textos pintados, fallbacks, desbordes), nunca píxeles.

function mockCtx() {
  const gradient = { addColorStop: vi.fn() }
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    measureText: (texto: string) => ({ width: texto.length * 8 }),
    createLinearGradient: () => gradient,
  }
  for (const m of [
    'fillRect', 'strokeRect', 'fillText', 'beginPath', 'moveTo', 'lineTo',
    'stroke', 'fill', 'save', 'restore', 'clip', 'arcTo', 'closePath',
    'drawImage', 'roundRect',
  ]) {
    ctx[m] = vi.fn()
  }
  return ctx as unknown as CanvasRenderingContext2D & {
    fillText: ReturnType<typeof vi.fn>
    drawImage: ReturnType<typeof vi.fn>
  }
}

function textosPintados(ctx: ReturnType<typeof mockCtx>) {
  return ctx.fillText.mock.calls.map((c: unknown[]) => String(c[0]))
}

describe('jerarquía por caligrafía — consistencia del tema', () => {
  it('cada rango del orden tiene kanji y caligrafía', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_KANJI[tier as keyof typeof TIER_KANJI]).toBeTruthy()
      expect(TIER_CALIGRAFIA[tier as keyof typeof TIER_CALIGRAFIA]).toBeTruthy()
    }
  })

  it('tamaño y tinta descienden estrictamente con el rango (S manda)', () => {
    const cal = TIER_ORDER.map(
      (t) => TIER_CALIGRAFIA[t as keyof typeof TIER_CALIGRAFIA],
    )
    for (let i = 1; i < cal.length; i += 1) {
      expect(cal[i].size).toBeLessThan(cal[i - 1].size)
      expect(cal[i].ink).toBeLessThan(cal[i - 1].ink)
    }
    expect(cal.filter((c) => c.bright)).toHaveLength(1)
    expect(TIER_CALIGRAFIA.S.bright).toBe(true)
  })
})

describe('tokens del tema — fallback sin hoja aplicada', () => {
  it('sin tokens CSS cae al hex de respaldo y deriva el alpha en rgb', () => {
    // happy-dom no resuelve los custom properties de @theme: el getter
    // perezoso debe servir el fallback y conAlpha derivarlo legible.
    expect(TIERLIST_EXPORT_THEME.gold).toBe('#c5a15a')
    expect(TIERLIST_EXPORT_THEME.frameOuter).toBe('rgb(197 161 90 / 0.55)')
    expect(TIERLIST_EXPORT_THEME.bandHairline).toBe('rgb(255 255 255 / 0.05)')
  })
})

describe('renderTierListExport — el PNG compartible', () => {
  const base = { titulo: 'Mi tier list', rows: {} }

  it('pinta los seis kanji de rango, el wordmark y el sello de batalla', async () => {
    const ctx = mockCtx()
    await renderTierListExport(ctx, { ...base })
    const textos = textosPintados(ctx)
    for (const kanji of Object.values(TIER_KANJI)) {
      expect(textos).toContain(kanji)
    }
    expect(textos).toContain('AnimeShowdown')
    expect(textos).toContain('戦')
    expect(textos).toContain('animeshowdown.dev/tier-lists')
  })

  it('trunca el título largo con elipsis sin desbordar la cabecera', async () => {
    const ctx = mockCtx()
    const titulo = 'La tier list definitiva de protagonistas shonen '.repeat(5)
    await renderTierListExport(ctx, { ...base, titulo })
    const pintado = textosPintados(ctx).find((t) => t.endsWith('…'))
    expect(pintado).toBeTruthy()
    expect((pintado as string).length).toBeLessThan(titulo.length)
  })

  it('la cabecera lleva el usuario cuando se aporta', async () => {
    const ctx = mockCtx()
    await renderTierListExport(ctx, { ...base, usuario: '@miyamoto' })
    expect(textosPintados(ctx).some((t) => t.startsWith('@miyamoto · '))).toBe(true)
  })

  it('sin cargador de imagen la carta pinta sus iniciales (placeholder)', async () => {
    const ctx = mockCtx()
    await renderTierListExport(ctx, {
      ...base,
      rows: { S: [{ nombre: 'Monkey D. Luffy', imagenColorDominante: '#123456' }] },
    })
    expect(textosPintados(ctx)).toContain('MD')
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('un loadImage que revienta cae al placeholder sin romper el render', async () => {
    const ctx = mockCtx()
    await renderTierListExport(ctx, {
      ...base,
      rows: { S: [{ nombre: 'Roronoa Zoro' }] },
      loadImage: async () => {
        throw new Error('CDN caída')
      },
    })
    expect(textosPintados(ctx)).toContain('RZ')
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('con imagen real recorta en cover y no pinta iniciales', async () => {
    const ctx = mockCtx()
    const img = { width: 300, height: 450 } as HTMLImageElement
    await renderTierListExport(ctx, {
      ...base,
      rows: { S: [{ nombre: 'Monkey D. Luffy' }] },
      loadImage: async () => img,
    })
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(textosPintados(ctx)).not.toContain('MD')
  })

  it('la banda desbordada anuncia +N en vez de apretar las cartas', async () => {
    const ctx = mockCtx()
    const muchos = Array.from({ length: 40 }, (_, i) => ({ nombre: `P ${i}` }))
    await renderTierListExport(ctx, { ...base, rows: { S: muchos } })
    // 1200 de ancho → 22 tiles visibles por banda; el resto se anuncia
    expect(textosPintados(ctx)).toContain('+18')
  })
})
